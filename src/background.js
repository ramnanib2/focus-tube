/* The service worker is the only writer of settings and unlock state. */
importScripts('core.js');
const C = FocusCore;
const SETTINGS_KEY = 'focusSettings';
const SESSION_KEY = 'focusSession';
const BREAK_ALARM = 'focus-break-ended';
const channelCache = new Map();
const videoCache = new Map();
const imageRequests = new Set();
let mutationQueue = Promise.resolve();
let initialization;

async function initialize() {
  if (!initialization) initialization = (async () => {
    await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    if (!stored[SETTINGS_KEY]) await chrome.storage.local.set({ [SETTINGS_KEY]: C.defaults() });
  })().catch(error => { initialization = null; throw error; });
  return initialization;
}
async function getState() {
  await initialize();
  const [local, session] = await Promise.all([chrome.storage.local.get(SETTINGS_KEY), chrome.storage.session.get(SESSION_KEY)]);
  const settings = local[SETTINGS_KEY];
  const until = session[SESSION_KEY]?.standardUntil || 0;
  return { settings, mode: C.standardActive(until) ? 'standard' : 'focus', standardUntil: C.standardActive(until) ? until : 0 };
}
async function updateBadge(state) {
  await chrome.action.setBadgeText({ text: state.mode === 'standard' ? 'OPEN' : 'ON' });
  await chrome.action.setBadgeBackgroundColor({ color: state.mode === 'standard' ? '#5f6368' : '#1a73e8' });
}
async function broadcast() {
  const state = await getState();
  await updateBadge(state);
  const tabs = await chrome.tabs.query({ url: ['https://www.youtube.com/*', 'https://youtube.com/*'] });
  await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { type: 'state.changed', state })));
  // Extension pages also receive changes through chrome.storage.onChanged.
  return state;
}
async function focusNow() {
  const stored = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] || {};
  await chrome.storage.session.set({ [SESSION_KEY]: { standardUntil: 0, lastPassage: stored.lastPassage || '' } });
  await chrome.alarms.clear(BREAK_ALARM);
}
async function fetchYouTube(url) {
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(12000), cache: 'no-cache' });
  if (!response.ok) throw new Error(`YouTube returned ${response.status}. Try again shortly.`);
  if (!['www.youtube.com', 'youtube.com'].includes(new URL(response.url).hostname)) throw new Error('YouTube requires consent or sign-in before channel details can be read.');
  const text = await response.text();
  if (text.length > 12_000_000) throw new Error('YouTube returned an unexpectedly large page.');
  return text;
}
async function cachedRequest(cache, key, loader, ttl) {
  const found = cache.get(key);
  if (found && found.expires > Date.now()) return found.promise;
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  const entry = { expires: Date.now() + ttl, promise: null };
  entry.promise = loader().catch(error => { if (cache.get(key) === entry) cache.delete(key); throw error; });
  cache.set(key, entry);
  return entry.promise;
}
async function resolveChannel(input) {
  const url = C.channelInput(input);
  return cachedRequest(channelCache, url, async () => C.parseChannelPage(await fetchYouTube(`${url}?hl=en`), url), 5 * 60_000);
}
async function videoOwner(id) {
  if (!C.VIDEO_ID.test(id || '')) throw new Error('Invalid video ID.');
  return cachedRequest(videoCache, id, async () => C.parseVideoPage(await fetchYouTube(`https://www.youtube.com/watch?v=${id}&hl=en`), id), 60 * 60_000);
}
async function saveCatalog(channels, source) {
  if (!Array.isArray(channels) || channels.length > 10000) throw new Error('YouTube returned an unsupported channel list.');
  const unique = new Map();
  for (const item of channels) {
    if (!C.CHANNEL_ID.test(item?.id || '')) continue;
    const url = `https://www.youtube.com/channel/${item.id}`;
    unique.set(item.id, { id:item.id, url, name:String(item.name || item.id).slice(0,160), handle:String(item.handle || '').slice(0,101), thumbnail:C.thumbnailUrl(item.thumbnail), aliases:[url], enabled:true });
  }
  const catalog = { id:C.id(), channels:[...unique.values()].sort((a,b)=>a.name.localeCompare(b.name)), createdAt:Date.now(), source };
  const task = mutationQueue.then(async () => {
    const stored = (await chrome.storage.session.get('focusCatalogs')).focusCatalogs || [];
    const catalogs = stored.filter(c => Date.now()-c.createdAt < 30*60_000).slice(-1);
    catalogs.push(catalog);
    await chrome.storage.session.set({focusCatalogs:catalogs});
    return {catalog};
  });
  mutationQueue = task.catch(()=>{});
  return task;
}
async function loadSubscriptions() {
  const tabs = await chrome.tabs.query({url:['https://www.youtube.com/*','https://youtube.com/*']});
  tabs.sort((a,b)=>Number(b.active)-Number(a.active));
  if (!tabs.length) throw new Error('Open YouTube and sign in in this browser, then refresh your subscriptions.');
  let failure;
  for (const tab of tabs) {
    try {
      const reply = await chrome.tabs.sendMessage(tab.id,{type:'subscriptions.read'});
      if (!reply?.ok) throw new Error(reply?.error || 'Reload your YouTube tab, then refresh subscriptions.');
      return saveCatalog(reply.channels, 'subscriptions');
    } catch (error) { failure=error; }
  }
  throw new Error(failure?.message?.includes('Receiving end') ? 'Reload your YouTube tab to connect the updated extension, then refresh subscriptions.' : failure?.message || 'Could not read your subscriptions.');
}
async function refreshChannelImages() {
  const state=await getState();
  const channels=C.selectedChannels(state.settings).filter(c=>!C.thumbnailUrl(c.thumbnail)&&!imageRequests.has(c.id)).slice(0,20);
  if (!channels.length) return {};
  channels.forEach(c=>imageRequests.add(c.id));
  const found=[];
  // Fetch a few avatars at a time; profile edits remain available during requests.
  for (let i=0;i<channels.length;i+=3) {
    const results=await Promise.allSettled(channels.slice(i,i+3).map(c=>resolveChannel(c.url)));
    for (const result of results) if (result.status==='fulfilled' && result.value.thumbnail) found.push(result.value);
  }
  if (!found.length) return {};
  const task=mutationQueue.then(async()=>{
    const latest=await getState();
    for (const profile of latest.settings.profiles) for (const channel of profile.channels) {
      const match=found.find(c=>c.id===channel.id);
      if (match) channel.thumbnail=match.thumbnail;
    }
    await chrome.storage.local.set({[SETTINGS_KEY]:latest.settings});
    return {state:await broadcast()};
  });
  mutationQueue=task.catch(()=>{});
  return task;
}
function extensionPage(sender) {
  return sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(''));
}
function youtubePage(sender) {
  try { const url = new URL(sender.url); return sender.id === chrome.runtime.id && url.protocol === 'https:' && ['www.youtube.com', 'youtube.com'].includes(url.hostname); } catch { return false; }
}
function profileFor(settings, id) {
  const profile = settings.profiles.find(p => p.id === id);
  if (!profile) throw new Error('This profile no longer exists.');
  return profile;
}
async function openPage(path) {
  await chrome.tabs.create({ url: chrome.runtime.getURL(path) });
}
async function handleMutation(message, sender) {
  const trusted = extensionPage(sender);
  if (!trusted && message.type !== 'mode.focus') throw new Error('Open Focus Tube to change profiles or modes.');
  const state = await getState();
  const settings = structuredClone(state.settings);
  let save = false;
  switch (message.type) {
    case 'profile.create': {
      if (settings.profiles.length >= 50) throw new Error('You can create up to 50 profiles.');
      const profile = C.newProfile(message.name);
      if (message.copyFrom) profile.channels = structuredClone(profileFor(settings, message.copyFrom).channels);
      settings.profiles.push(profile); settings.activeProfileId = profile.id;
      await focusNow(); save = true; break;
    }
    case 'profile.rename': profileFor(settings, message.profileId).name = C.cleanName(message.name); save = true; break;
    case 'profile.activate': profileFor(settings, message.profileId); settings.activeProfileId = message.profileId; await focusNow(); save = true; break;
    case 'profile.delete': {
      if (settings.profiles.length === 1) throw new Error('Keep at least one focus profile.');
      profileFor(settings, message.profileId);
      settings.profiles = settings.profiles.filter(p => p.id !== message.profileId);
      if (settings.activeProfileId === message.profileId) { settings.activeProfileId = settings.profiles[0].id; await focusNow(); }
      save = true; break;
    }
    case 'channel.add': {
      const profile = profileFor(settings, message.profileId);
      const channel = await resolveChannel(message.input);
      const existing = profile.channels.find(c => c.id === channel.id);
      if (existing) Object.assign(existing, channel, { enabled: true });
      else {
        if (profile.channels.length >= 500) throw new Error('This profile already has 500 channels.');
        profile.channels.push(channel);
      }
      save = true; break;
    }
    case 'channel.addMany': {
      const profile = profileFor(settings,message.profileId);
      const catalogs = (await chrome.storage.session.get('focusCatalogs')).focusCatalogs || [];
      const catalog = catalogs.find(c => c.id === message.catalogId && Date.now()-c.createdAt < 30*60_000);
      if (!catalog) throw new Error('This list expired. Refresh it and try again.');
      if (!Array.isArray(message.channelIds) || !message.channelIds.length || message.channelIds.length>500) throw new Error('Select between 1 and 500 channels.');
      const ids=[...new Set(message.channelIds)];
      const selected=ids.map(id=>catalog.channels.find(c=>c.id===id));
      if (selected.some(c=>!c)) throw new Error('A selected channel is missing from this list. Refresh it and try again.');
      if (profile.channels.length+selected.filter(c=>!profile.channels.some(existing=>existing.id===c.id)).length>500) throw new Error('Each profile supports up to 500 saved channels. Nothing was added.');
      for (const channel of selected) {
        const existing=profile.channels.find(c=>c.id===channel.id);
        if (existing) Object.assign(existing,channel,{thumbnail:channel.thumbnail || existing.thumbnail || '',enabled:true});
        else profile.channels.push({...channel,enabled:true});
      }
      save=true;break;
    }
    case 'channel.toggle': {
      const channel = profileFor(settings, message.profileId).channels.find(c => c.id === message.channelId);
      if (!channel) throw new Error('Channel not found.');
      channel.enabled = message.enabled === true; save = true; break;
    }
    case 'channel.remove': {
      const profile = profileFor(settings, message.profileId);
      profile.channels = profile.channels.filter(c => c.id !== message.channelId); save = true; break;
    }
    case 'settings.shorts': settings.hideShorts = message.hidden !== false; save = true; break;

    case 'mode.focus': await focusNow(); break;
    case 'challenge.create': {
      const stored = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] || {};
      const previous = (await chrome.storage.local.get('lastUnlockPassage')).lastUnlockPassage || stored.lastPassage;
      const passage = C.makePassage(previous);
      const challenge = { id: C.id(), passage, createdAt: Date.now() };
      await chrome.storage.local.set({ lastUnlockPassage: passage });
      await chrome.storage.session.set({ [SESSION_KEY]: { ...stored, challenge, lastPassage: passage } });
      return { challenge };
    }
    case 'challenge.cancel': {
      const stored = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] || {};
      if (stored.challenge?.id === message.challengeId) {
        delete stored.challenge;
        await chrome.storage.session.set({ [SESSION_KEY]: stored });
      }
      return {};
    }
    case 'challenge.submit': {
      const stored = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] || {};
      const challenge = stored.challenge;
      if (!challenge || challenge.id !== message.challengeId || Date.now() - challenge.createdAt > 30 * 60_000) throw new Error('This passage expired or was replaced. Generate a new passage.');
      if (C.normalizePassage(message.text) !== C.normalizePassage(challenge.passage)) throw new Error('Type the complete passage exactly as shown.');
      const minutes = Number(message.minutes);
      if (![15, 30, 60].includes(minutes)) throw new Error('Choose a supported break duration.');
      const standardUntil = Date.now() + minutes * 60_000;
      await chrome.storage.session.set({ [SESSION_KEY]: { standardUntil, lastPassage: challenge.passage } });
      await chrome.alarms.create(BREAK_ALARM, { when: standardUntil });
      break;
    }
    default: throw new Error('Unknown action.');
  }
  if (save) await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return { state: await broadcast() };
}
async function handle(message, sender) {
  if (!message || typeof message.type !== 'string' || (!extensionPage(sender) && !youtubePage(sender))) throw new Error('Unsupported sender.');
  switch (message.type) {
    case 'state.get': return { state: await getState() };
    case 'page.manager': {
      let path = 'app.html';
      if (message.channel) path += `?channel=${encodeURIComponent(C.channelInput(message.channel))}`;
      await openPage(path); return {};
    }
    case 'page.unlock': await openPage('unlock.html'); return {};
    case 'video.owner': return { owner: await videoOwner(message.videoId) };
    case 'channel.resolve': return { channel: await resolveChannel(message.input) };
    case 'channel.images': return refreshChannelImages();
    case 'subscriptions.list':
      if (!extensionPage(sender)) throw new Error('Open your profile manager to choose subscriptions.');
      return loadSubscriptions();
    case 'channel.search': {
      if (!extensionPage(sender)) throw new Error('Open your profile manager to search channels.');
      const query=String(message.query || '').trim();
      if (!query || query.length>100) throw new Error('Enter a channel name up to 100 characters.');
      const html=await fetchYouTube(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
      const {channels}=C.catalogFromData(C.pageData(html));
      return saveCatalog(channels.slice(0,30),'search');
    }
    case 'page.subscriptions':
      if (!extensionPage(sender)) throw new Error('Open your profile manager first.');
      await chrome.tabs.create({url:'https://www.youtube.com/feed/channels'});return {};
    default: {
      // Serialize writes to avoid lost updates across popups, tabs, and the options page.
      const task = mutationQueue.then(() => handleMutation(message, sender));
      mutationQueue = task.catch(() => {});
      return task;
    }
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  handle(message, sender).then(result => respond({ ok: true, ...result }), error => respond({ ok: false, error: error.message || 'Something went wrong.' }));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== BREAK_ALARM) return;
  const task = mutationQueue.then(async () => {
    const state = await getState();
    if (state.mode === 'focus') { await focusNow(); await broadcast(); }
  });
  mutationQueue = task.catch(() => {});
});
chrome.runtime.onInstalled.addListener(() => { initialize().then(broadcast).catch(console.error); });
chrome.runtime.onStartup.addListener(() => { initialize().then(broadcast).catch(console.error); });
