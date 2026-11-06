(() => {
  'use strict';
  const C = FocusCore;
  const CARD = 'ytd-rich-item-renderer,ytd-video-renderer,ytd-grid-video-renderer,ytd-compact-video-renderer,ytd-playlist-video-renderer,ytd-playlist-panel-video-renderer,yt-lockup-view-model,.yt-lockup-view-model,ytm-shorts-lockup-view-model,yt-shorts-lockup-view-model';
  const root = document.documentElement;
  let state = null, generation = 0, scanTimer, watchToken = '', watchAllowed = false;
  let approvedChannelId=null, channelToken='';
  let host, shadow, toolbar, blocker, emptyPanel, homeHost, homeShadow, homeStamp='';
  let filteredCount = 0, visibleCount = 0, running = 0;
  const pending = [];
  const identities = new Map(), owners = new Map(), signatures = new WeakMap();
  const failedUntil = new Map();

  async function send(message) {
    const reply = await chrome.runtime.sendMessage(message);
    if (!reply?.ok) throw new Error(reply?.error || 'Focus Tube is unavailable. Reload this tab.');
    return reply;
  }
  async function readSubscriptions() {
    const localConfig = [...document.scripts].map(s => C.jsonObjectAfter(s.textContent || '', 'ytcfg.set(')).find(Boolean) || {};
    const query = new URLSearchParams({hl:'en'});
    if (/^\d+$/.test(String(localConfig.SESSION_INDEX ?? ''))) query.set('authuser',String(localConfig.SESSION_INDEX));
    const response = await fetch(`${location.origin}/feed/channels?${query}`,{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(20000)});
    if (!response.ok || !['www.youtube.com','youtube.com'].includes(new URL(response.url).hostname)) throw new Error('Sign in to YouTube in this browser, then refresh your subscriptions.');
    const html = await response.text();
    if (html.length>15_000_000) throw new Error('Your subscriptions page is too large to read.');
    const config = C.jsonObjectAfter(html,'ytcfg.set(') || {};
    if (config.LOGGED_IN === false) throw new Error('Sign in to YouTube in this browser, then refresh your subscriptions.');
    let page = C.catalogFromData(C.pageData(html));
    const channels = new Map(page.channels.map(c=>[c.id,c])), tokens = new Set();
    for (let count=0;page.continuation;count++) {
      if (count>=50 || tokens.has(page.continuation) || !config.INNERTUBE_CONTEXT?.client) throw new Error('YouTube could not load the full subscriptions list. Reload YouTube and try again.');
      tokens.add(page.continuation);
      const headers={'Content-Type':'application/json','X-Youtube-Client-Name':'1','X-Youtube-Client-Version':String(config.INNERTUBE_CONTEXT.client.clientVersion || '')};
      if (config.SESSION_INDEX !== undefined) headers['X-Goog-AuthUser']=String(config.SESSION_INDEX);
      if (config.DELEGATED_SESSION_ID) headers['X-Goog-PageId']=String(config.DELEGATED_SESSION_ID);
      const next=await fetch(`${location.origin}/youtubei/v1/browse?prettyPrint=false`,{method:'POST',credentials:'include',headers,body:JSON.stringify({context:config.INNERTUBE_CONTEXT,continuation:page.continuation}),signal:AbortSignal.timeout(20000)});
      if (!next.ok) throw new Error('Could not load the rest of your subscriptions. Refresh and try again.');
      page=C.catalogFromData(await next.json());
      page.channels.forEach(c=>channels.set(c.id,c));
    }
    return [...channels.values()];
  }
  function isFocus() { return !state || state.mode !== 'standard' || !C.standardActive(state.standardUntil); }
  function schedule() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 100); }
  function request(key, loader, priority = false) {
    if ((failedUntil.get(key) || 0) > Date.now()) return Promise.resolve(null);
    return new Promise(resolve => { const job = { key, loader, resolve }; if (priority) pending.unshift(job); else pending.push(job); pump(); });
  }
  function pump() {
    while (running < 3 && pending.length) {
      const job = pending.shift(); running++;
      job.loader().then(job.resolve, () => { failedUntil.set(job.key, Date.now() + 30_000); job.resolve(null); }).finally(() => { running--; pump(); });
    }
  }
  async function channelIdFor(href) {
    const url=new URL(href,location.origin).href;
    const key = C.identity(url);
    if (!key) return null;
    if (key.startsWith('/channel/')) return url.match(/UC[A-Za-z0-9_-]{22}/)?.[0] || null;
    if (!identities.has(key)) {
      const preferred = state && C.allowsIdentity(state.settings,url);
      identities.set(key, request(key, async () => (await send({ type: 'channel.resolve', input:url })).channel.id, preferred));
    }
    const result = await identities.get(key);
    if (!result) identities.delete(key);
    return result;
  }
  function ownerFor(id, priority = false) {
    if (!owners.has(id)) owners.set(id, request(id, async () => (await send({ type: 'video.owner', videoId: id })).owner.channelId, priority));
    return owners.get(id).then(result => { if (!result) owners.delete(id); return result; });
  }
  function authorHref(card) {
    const links = [...card.querySelectorAll('ytd-channel-name a[href],#channel-name a[href],#byline-container a[href],yt-content-metadata-view-model a[href],.ytContentMetadataViewModelMetadataRow a[href]')]
      .filter(a => C.identity(new URL(a.getAttribute('href'), location.origin).href));
    const unique = [...new Set(links.map(a => a.getAttribute('href')))];
    // Descriptions can mention unrelated creators. Only trust an unambiguous owner byline.
    // Collaborative cards or cards without a byline are verified by exact video ID instead.
    return unique.length === 1 ? unique[0] : '';
  }
  function cardInfo(card) {
    const links = [...card.querySelectorAll('a[href]')];
    const video = links.map(a => a.href).find(href => C.videoId(href));
    const id = video ? C.videoId(video) : null;
    const post=!!card.querySelector('ytd-post-renderer,ytd-backstage-post-renderer,ytd-backstage-post-thread-renderer');
    const collection=links.some(a=>{try{const url=new URL(a.href);return url.pathname==='/playlist'||(location.pathname.endsWith('/playlists')&&url.searchParams.has('list'));}catch{return false;}});
    return { id, author: authorHref(card), kind:post?'post':collection?'collection':'video', shorts: links.some(a => { try { return new URL(a.href).pathname.startsWith('/shorts'); } catch { return false; } }) };
  }
  function cardStamp(info){return JSON.stringify([generation,info.id,info.author,info.shorts,info.kind,approvedChannelId]);}
  function setAllowed(card, allowed) {
    const value = allowed ? 'true' : 'false';
    if (card.getAttribute('data-cf-allowed') !== value) card.setAttribute('data-cf-allowed', value);
  }
  function uploadsChannel() {
    // The explicit uploads/live tabs contain the channel's own uploads. Channel Home
    // can contain guest playlists, so it must still verify individual video owners.
    if (!/\/(videos|streams|shorts)\/?$/.test(location.pathname)) return null;
    try { return C.channelInput(location.href); } catch { return null; }
  }
  async function classify(card, info, stamp, currentGeneration) {
    if(state && info.kind!=='video'){setAllowed(card,!!approvedChannelId);return;}
    if(state && approvedChannelId && !info.id){setAllowed(card,true);return;}
    if (!state || !info.id || (info.shorts && state.settings.hideShorts && !approvedChannelId)) { setAllowed(card, false); return; }
    if (!C.selectedChannels(state.settings).length) { setAllowed(card, false); return; }
    const ownerHref = info.author || uploadsChannel();
    const channelId = ownerHref ? await channelIdFor(ownerHref) : await ownerFor(info.id);
    if (!card.isConnected || generation !== currentGeneration || !isFocus()) return;
    if (signatures.get(card) !== stamp) return;
    setAllowed(card, C.allowsChannel(state.settings, channelId));
    schedule();
  }
  async function checkChannelPage(){
    let url;
    try{url=C.channelInput(location.href);}catch{url=null;}
    const key=`${generation}:${location.pathname}`;
    if(checkChannelPage.key===key)return;
    checkChannelPage.key=key;approvedChannelId=null;root.dataset.cfApprovedChannel='false';channelToken='';
    if(!isFocus()||!url||!C.selectedChannels(state.settings).length)return;
    channelToken=key;
    const id=await channelIdFor(url);
    if(channelToken!==key||key!==`${generation}:${location.pathname}`||!isFocus())return;
    channelToken='';approvedChannelId=C.allowsChannel(state.settings,id)?id:null;
    root.dataset.cfApprovedChannel=approvedChannelId?'true':'false';schedule();
  }
  function ensureUI() {
    if (host?.isConnected || !document.body) return;
    host = document.createElement('div'); host.id = 'channel-focus-controls';
    shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { color-scheme:light dark; --bg:light-dark(#ffffff,#292a2d);--fg:light-dark(#202124,#e8eaed);--muted:light-dark(#5f6368,#bdc1c6);--line:light-dark(#dadce0,#5f6368);--accent:light-dark(#1a73e8,#8ab4f8);--on:light-dark(#fff,#202124); font:14px/1.5 system-ui,sans-serif; }
      *{box-sizing:border-box} [hidden]{display:none!important}
      button,a{font:inherit}button{cursor:pointer;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;padding:7px 10px}button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
      button.primary{background:var(--accent);color:var(--on);border-color:var(--accent)}
      .toolbar{position:fixed;bottom:18px;left:90px;z-index:2147483646;display:flex;align-items:center;gap:10px;flex-wrap:wrap;max-width:calc(100vw - 110px);padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--fg);box-shadow:0 6px 24px #0002}
      .mode{font-weight:650} .count{font-size:12px;color:var(--muted)}
      .empty{position:fixed;top:100px;left:50%;transform:translateX(-50%);z-index:2147483645;width:min(460px,calc(100vw - 36px));background:var(--bg);color:var(--fg);padding:22px;border:1px solid var(--line);border-radius:16px;box-shadow:0 8px 36px #0001}
      .blocker{position:fixed;inset:64px 0 0;z-index:2147483645;background:var(--bg);color:var(--fg);display:grid;place-items:center;padding:24px}.blocker>div{max-width:520px;width:100%}
      h2{font-size:24px;line-height:1.3;margin:0 0 10px}p{color:var(--muted);margin:0 0 18px}.actions{display:flex;gap:8px;flex-wrap:wrap}.channels{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px}.channels a{color:var(--accent);text-decoration:underline;padding:3px}
      @media(max-width:600px){.toolbar{left:12px;bottom:12px;max-width:calc(100vw - 24px)}.count{display:none}}
    `;
    toolbar = document.createElement('div'); toolbar.className = 'toolbar'; toolbar.setAttribute('aria-label', 'Focus Tube');
    const mode = document.createElement('span'); mode.className = 'mode'; mode.id = 'mode';
    const count = document.createElement('span'); count.className = 'count'; count.id = 'count';
    toolbar.append(mode, count, button('Profiles', () => send({ type: 'page.manager' })), button('Standard mode…', () => send({ type: 'page.unlock' }), 'standard'), button('Return to Focus', () => send({ type: 'mode.focus' }), 'return'), button('Add this channel', () => send({ type: 'page.manager', channel: location.href }), 'add'));
    emptyPanel = document.createElement('div'); emptyPanel.className = 'empty'; emptyPanel.hidden = true;
    blocker = document.createElement('div'); blocker.className = 'blocker'; blocker.hidden = true;
    shadow.append(style, emptyPanel, blocker, toolbar); document.body.append(host);
  }
  function button(label, action, id) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = label;
    if (id) el.id = id;
    el.onclick = () => Promise.resolve().then(action).catch(error => { shadow.querySelector('#count').textContent = error.message; });
    return el;
  }
  function channelLinks() {
    const list = document.createElement('div'); list.className = 'channels';
    for (const channel of C.selectedChannels(state.settings)) {
      const link = document.createElement('a'); link.href = `${channel.url}/videos`; link.textContent = channel.name; list.append(link);
    }
    return list;
  }
  function panelContent(panel, title, description) {
    const wrap = document.createElement('div');
    const heading = document.createElement('h2'); heading.textContent = title;
    const copy = document.createElement('p'); copy.textContent = description;
    const actions = document.createElement('div'); actions.className = 'actions';
    actions.append(button('Manage profiles', () => send({ type: 'page.manager' })), button('Standard mode…', () => send({ type: 'page.unlock' })));
    wrap.append(heading, copy, channelLinks(), actions); panel.replaceChildren(wrap);
  }
  function updateHomeShelf(focus) {
    const onHome=location.pathname==='/';
    if (!focus || !onHome) { if(homeHost)homeHost.hidden=true;return; }
    const target=document.querySelector('ytd-browse[page-subtype="home"] #primary') || document.querySelector('ytd-browse[page-subtype="home"]') || document.querySelector('ytd-page-manager') || document.body;
    if (!homeHost) {
      homeHost=document.createElement('div');homeHost.id='channel-focus-home';
      homeHost.style.cssText='display:block;width:100%;box-sizing:border-box;flex:0 0 100%;position:relative;z-index:1;';
      homeShadow=homeHost.attachShadow({mode:'open'});
    }
    if(homeHost.parentElement!==target)target.prepend(homeHost);
    homeHost.hidden=false;
    const profile=C.activeProfile(state.settings), channels=C.selectedChannels(state.settings);
    const stamp=JSON.stringify([profile.id,profile.name,channels.map(c=>[c.id,c.name,c.thumbnail]),visibleCount===0]);
    if(homeStamp===stamp)return;
    homeStamp=stamp;
    const style=document.createElement('style');style.textContent=`
      :host{font:14px/1.5 Roboto,Arial,sans-serif;color-scheme:light dark;color:light-dark(#202124,#e8eaed)}*{box-sizing:border-box}
      section{padding:24px 32px 18px;background:light-dark(#fff,#0f0f0f)}header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap}
      h2{font-size:22px;font-weight:600;margin:0 0 3px}p{margin:0;color:light-dark(#5f6368,#bdc1c6);font-size:13px}
      button{font:inherit;border:1px solid light-dark(#dadce0,#5f6368);background:light-dark(#fff,#292a2d);color:inherit;border-radius:9px;padding:9px 13px;cursor:pointer}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:14px}.channel{display:flex;flex-direction:column;align-items:center;gap:12px;border:1px solid light-dark(#dadce0,#3c4043);border-radius:13px;padding:20px 12px 16px;color:inherit;text-decoration:none;background:light-dark(#f8f9fa,#202124);text-align:center}
      .channel:hover{background:light-dark(#f1f3f4,#303134)}.avatar{position:relative;display:grid;place-items:center;width:72px;height:72px;background:light-dark(#e8eaed,#3c4043);color:light-dark(#1a73e8,#8ab4f8);border-radius:50%;overflow:hidden;font-weight:600;font-size:20px;flex-shrink:0}.avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.name{font-size:14px;font-weight:600;overflow-wrap:anywhere}.hint{margin-top:16px}a:focus-visible,button:focus-visible{outline:3px solid light-dark(#1a73e8,#8ab4f8);outline-offset:3px}
      @media(max-width:600px){section{padding:20px 16px}.grid{gap:10px}}
    `;
    const section=document.createElement('section');section.setAttribute('aria-label','Enabled focus channels');
    const header=document.createElement('header'), title=document.createElement('div'), heading=document.createElement('h2'), subtitle=document.createElement('p');
    heading.textContent='Your channels';subtitle.textContent=`${profile.name} · ${channels.length} enabled channel${channels.length===1?'':'s'}`;
    title.append(heading,subtitle);header.append(title,button('Manage channels',()=>send({type:'page.manager'})));
    const grid=document.createElement('div');grid.className='grid';
    for(const channel of channels){
      const link=document.createElement('a');link.className='channel';link.href=`${channel.url}/videos`;link.setAttribute('aria-label',`${channel.name} videos`);link.dataset.channelId=channel.id;
      const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent=channel.name.slice(0,2).toUpperCase();avatar.setAttribute('aria-hidden','true');
      const thumbnail=C.thumbnailUrl(channel.thumbnail);
      if(thumbnail){const img=document.createElement('img');img.src=thumbnail;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove());avatar.append(img);}
      const name=document.createElement('span');name.className='name';name.textContent=channel.name;link.append(avatar,name);grid.append(link);
    }
    section.append(header,grid);
    if(!channels.length || visibleCount===0){const hint=document.createElement('p');hint.className='hint';hint.textContent=channels.length?'No matching recommendations here yet. Open a channel to browse its videos.':'Add channels to this profile to start your focused session.';section.append(hint);}
    homeShadow.replaceChildren(style,section);
  }
  function updateUI() {
    ensureUI(); if (!shadow || !state) return;
    const focus = isFocus(), profile = C.activeProfile(state.settings);
    shadow.querySelector('#mode').textContent = focus ? `Focus · ${profile.name}` : 'Standard mode';
    shadow.querySelector('#count').textContent = focus ? `${visibleCount} shown · ${filteredCount} filtered` : `${Math.max(1, Math.ceil((state.standardUntil - Date.now()) / 60_000))} min remaining`;
    shadow.querySelector('#standard').hidden = !focus;
    shadow.querySelector('#return').hidden = focus;
    let channelPage = false;
    try { C.channelInput(location.href); channelPage = true; } catch { /* not a channel page */ }
    shadow.querySelector('#add').hidden = !channelPage;
    updateHomeShelf(focus);
    if (!focus) { blocker.hidden = true; emptyPanel.hidden = true; return; }
    const isVideoPage = ['/watch', '/shorts', '/live'].some(path => location.pathname === path || location.pathname.startsWith(path + '/'));
    blocker.hidden = !isVideoPage || watchAllowed;
    if (!blocker.hidden) {
      panelContent(blocker, watchToken ? 'Checking this video’s channel…' : 'This video is outside your focus profile', 'Only videos uploaded by your selected channels can play in Focus mode.');
      if (!watchToken && C.videoId(location.href) && !location.pathname.startsWith('/shorts')) {
        blocker.querySelector('.actions').prepend(button('Retry check', () => {
          const id = C.videoId(location.href); owners.delete(id); failedUntil.delete(id); checkWatch.key = ''; schedule();
        }));
      }
    }
    const isFeed = !isVideoPage && !location.pathname.startsWith('/account') && !location.pathname.startsWith('/paid_memberships');
    emptyPanel.hidden = !!approvedChannelId || !!channelToken || location.pathname==='/' || !isFeed || visibleCount > 0;
    if (!emptyPanel.hidden) {
      const hasChannels = C.selectedChannels(state.settings).length > 0;
      panelContent(emptyPanel, hasChannels ? 'No matching videos here' : 'Choose your first channels', hasChannels ? 'YouTube has not offered a verified video from this profile here. Browse one of your channels directly.' : 'Add channels to this profile to start a focused YouTube session.');
    }
  }
  function guardVideo(event) {
    if (isFocus() && (!watchAllowed || !C.videoId(location.href))) {
      if (event?.target instanceof HTMLMediaElement) event.target.pause();
      document.querySelectorAll('video').forEach(video => { if (!video.paused) video.pause(); });
    }
  }
  async function checkWatch() {
    const id = C.videoId(location.href);
    const key = `${generation}:${location.pathname}:${id || ''}`;
    if (!isFocus()) { watchAllowed = true; root.dataset.cfWatch = 'allowed'; return; }
    if (checkWatch.key === key) return;
    checkWatch.key = key; watchAllowed = false; root.dataset.cfWatch = 'blocked';
    if (!id) { watchToken = ''; guardVideo(); return; }
    watchToken = key; guardVideo(); updateUI();
    const channelId = await ownerFor(id, true);
    if (watchToken !== key || C.videoId(location.href) !== id || !isFocus()) return;
    watchToken = ''; watchAllowed = C.allowsChannel(state.settings, channelId);
    if(location.pathname.startsWith('/shorts')&&watchAllowed){
      // Approved creators' Shorts remain watchable without opening an unchecked endless feed.
      watchAllowed=false;location.replace(`https://www.youtube.com/watch?v=${id}`);return;
    }
    root.dataset.cfWatch = watchAllowed ? 'allowed' : 'blocked';
    if (!watchAllowed) guardVideo();
    updateUI();
  }
  function scan() {
    if (!state || !document.body) return;
    if (!isFocus()) { updateUI(); return; }
    checkChannelPage().catch(()=>{channelToken='';approvedChannelId=null;root.dataset.cfApprovedChannel='false';updateUI();});
    visibleCount = 0; filteredCount = 0;
    for (const card of document.querySelectorAll(CARD)) {
      const info = cardInfo(card);
      const stamp = cardStamp(info);
      if (signatures.get(card) !== stamp) {
        signatures.set(card, stamp); setAllowed(card, false);
        classify(card, info, stamp, generation).catch(() => setAllowed(card, false));
      }
      // Count only outermost cards so nested modern renderers are not counted twice.
      if (!card.parentElement?.closest(CARD)) {
        if (card.dataset.cfAllowed === 'true') visibleCount++; else filteredCount++;
      }
    }
    checkWatch().catch(() => { watchToken = ''; watchAllowed = false; guardVideo(); updateUI(); });
    guardVideo(); updateUI();
  }
  function applyState(next) {
    state = next;
    const filterKey=JSON.stringify([isFocus(),state.settings.activeProfileId,state.settings.hideShorts,C.selectedChannels(state.settings).map(c=>c.id).sort()]);
    if(applyState.key===filterKey){schedule();return;}
    applyState.key=filterKey;generation++;
    approvedChannelId=null;channelToken='';checkChannelPage.key='';root.dataset.cfApprovedChannel='false';
    root.dataset.cfMode = isFocus() ? 'focus' : 'standard';
    root.dataset.cfShorts = state.settings.hideShorts ? 'hide' : 'show';
    watchAllowed = !isFocus(); root.dataset.cfWatch = watchAllowed ? 'allowed' : 'blocked';
    watchToken = ''; checkWatch.key = '';
    if (isFocus()) {
      document.querySelectorAll('[data-cf-allowed]').forEach(card => setAllowed(card, false));
      guardVideo();
    }
    schedule();
    if(location.pathname==='/' && C.selectedChannels(state.settings).some(c=>!C.thumbnailUrl(c.thumbnail)))send({type:'channel.images'}).catch(()=>{});
  }
  document.addEventListener('play', guardVideo, true);
  document.addEventListener('playing', guardVideo, true);
  document.addEventListener('yt-navigate-start', () => {
    if (isFocus()) { watchAllowed = false; watchToken = ''; checkWatch.key = ''; root.dataset.cfWatch = 'blocked'; guardVideo(); }
    approvedChannelId=null;channelToken='';checkChannelPage.key='';root.dataset.cfApprovedChannel='false';
    emptyPanel && (emptyPanel.hidden = true);
    if(homeHost)homeHost.hidden=true;
  });
  document.addEventListener('yt-navigate-finish', schedule);
  window.addEventListener('popstate', () => { checkWatch.key = ''; schedule(); });
  // Block unverified navigation through the YouTube player's next-video controls.
  document.addEventListener('click', event => {
    if (isFocus() && event.target instanceof Element && event.target.closest('.ytp-next-button,.ytp-autonav-toggle-button-container')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  chrome.runtime.onMessage.addListener((message,sender,respond) => {
    if (message.type === 'state.changed') applyState(message.state);
    if (message.type === 'subscriptions.read' && sender.id === chrome.runtime.id) {
      readSubscriptions().then(channels=>respond({ok:true,channels}),error=>respond({ok:false,error:error.message}));
      return true;
    }
    return false;
  });
  const observer = new MutationObserver(records => {
    for (const record of records) {
      let parent = record.target instanceof Element ? record.target.closest(CARD) : record.target.parentElement?.closest(CARD);
      while (parent) {
        const info = cardInfo(parent);
        const stamp = cardStamp(info);
        // Hover previews, progress bars and thumbnail animations change the DOM
        // without changing the uploader. Keep verified cards visible through those updates.
        if (signatures.get(parent) !== stamp) { setAllowed(parent, false); signatures.delete(parent); }
        parent = parent.parentElement?.closest(CARD);
      }
    }
    if (records.some(record => record.target !== host && !host?.contains(record.target) && !(record.type === 'attributes' && record.attributeName?.startsWith('data-cf')))) schedule();
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'video-id'] });
  setInterval(() => {
    if (state?.mode === 'standard' && !C.standardActive(state.standardUntil)) applyState({ ...state, mode: 'focus', standardUntil: 0 });
    else if (state?.mode === 'standard') updateUI();
    if (isFocus()) guardVideo();
  }, 1000);
  send({ type: 'state.get' }).then(reply => applyState(reply.state)).catch(() => {
    // Keep the CSS filter closed if the extension was reloaded or its worker is unavailable.
    if (document.body) {
      ensureUI(); shadow.querySelector('#mode').textContent = 'Reload to reconnect Focus Tube';
    }
  });
})();
