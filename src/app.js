(() => {
  'use strict';
  const C = FocusCore, UI = FocusUI, $ = id => document.getElementById(id);
  let state, dialogAction = 'create', adding = false;
  let picker=null, pickerRequest=0;
  function avatarFor(channel) {
    const avatar=document.createElement('span');avatar.className='channel-avatar';avatar.textContent=channel.name.slice(0,2).toUpperCase();avatar.setAttribute('aria-hidden','true');
    const url=C.thumbnailUrl(channel.thumbnail);
    if(url){const image=document.createElement('img');image.src=url;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>image.remove());avatar.append(image);}
    return avatar;
  }
  function render(next) {
    state = next;
    const profile = C.activeProfile(state.settings);
    $('profile-count').textContent = state.settings.profiles.length;
    $('profile-name').textContent = profile.name;
    $('breadcrumb-profile').textContent = profile.name;
    document.title = `${profile.name} · Focus Tube`;
    const list = $('profile-list'); list.replaceChildren();
    state.settings.profiles.forEach(p => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'profile-button'; button.classList.toggle('active', p.id === profile.id);
      button.setAttribute('aria-current', p.id === profile.id ? 'true' : 'false');
      const initial = document.createElement('span'); initial.className = 'profile-initial'; initial.textContent = p.name.slice(0, 1).toUpperCase();
      const name = document.createElement('span'); name.className = 'profile-label'; name.textContent = p.name;
      const count = document.createElement('span'); count.className = 'profile-size'; count.textContent = p.channels.filter(c => c.enabled).length;
      button.append(initial, name, count);
      button.onclick = () => UI.action('profile.activate', { profileId: p.id }).catch(error => UI.notice(error.message, true)); list.append(button);
    });
    const selected = profile.channels.filter(c => c.enabled).length;
    $('channel-count').textContent = profile.channels.length;
    $('selected-count').textContent = `${selected} selected for this profile`;
    $('channel-empty').hidden = profile.channels.length > 0;
    $('delete-profile').disabled = state.settings.profiles.length === 1;
    $('hide-shorts').checked = state.settings.hideShorts;
    const container = $('channels'); container.replaceChildren();
    profile.channels.forEach(channel => {
      const row = document.createElement('div'); row.className = `channel-row${channel.enabled ? '' : ' deselected'}`;
      const label = document.createElement('label'); label.className = 'channel-toggle';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = channel.enabled; checkbox.setAttribute('aria-label', `Include ${channel.name} in ${profile.name}`);
      checkbox.onchange = async () => { checkbox.disabled = true; try { await UI.action('channel.toggle', { profileId: profile.id, channelId: channel.id, enabled: checkbox.checked }); } catch (error) { checkbox.checked = !checkbox.checked; checkbox.disabled = false; UI.notice(error.message, true); } };
      const avatar = avatarFor(channel);
      const info = document.createElement('span'); info.className = 'channel-info';
      const name = document.createElement('strong'); name.textContent = channel.name;
      const handle = document.createElement('span'); handle.textContent = channel.handle || channel.id;
      info.append(name, handle); label.append(checkbox, avatar, info);
      const actions = document.createElement('div'); actions.className = 'channel-actions';
      const link = document.createElement('a'); link.href = `${channel.url}/videos`; link.textContent = 'Visit ↗'; link.className = 'text-link'; link.target = '_blank'; link.rel = 'noreferrer'; link.setAttribute('aria-label', `Visit ${channel.name}`);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${channel.name}`);
      remove.onclick = () => UI.action('channel.remove', { profileId: profile.id, channelId: channel.id }).catch(error => UI.notice(error.message, true));
      actions.append(link, remove); row.append(label, actions); container.append(row);
    });
    const standard = state.mode === 'standard';
    $('break-banner').hidden = !standard;
    $('break-remaining').textContent = `Focus returns in ${UI.remaining(state.standardUntil)} minutes. Your profile is ready when you are.`;
    if (picker) {
      if (picker.profileId !== profile.id) {
        if (picker.source === 'search') { openPicker('subscriptions'); return; }
        picker.profileId = profile.id;
        picker.selected.clear();
      }
      // Selections always belong to the active profile, including changes from another tab.
      const enabled = new Set(profile.channels.filter(c => c.enabled).map(c => c.id));
      for (const id of picker.selected) if (enabled.has(id)) picker.selected.delete(id);
      $('picker-profile').textContent = `Add to ${profile.name}${picker.query ? ` · Results for “${picker.query}”` : ''}`;
      renderPicker();
    }
  }
  function openDialog(action) {
    dialogAction = action;
    const profile = C.activeProfile(state.settings);
    $('dialog-title').textContent = action === 'rename' ? 'Rename profile' : action === 'duplicate' ? 'Duplicate profile' : 'New focus profile';
    $('profile-input').value = action === 'rename' ? profile.name : action === 'duplicate' ? `${profile.name.slice(0, 53)} copy` : '';
    $('profile-dialog').showModal(); $('profile-input').focus();
  }
  function pickerChannels() {
    const query=$('picker-filter').value.trim().toLocaleLowerCase();
    return (picker?.catalog?.channels || []).filter(c=>`${c.name} ${c.handle}`.toLocaleLowerCase().includes(query));
  }
  function renderPicker() {
    if(!picker)return;
    const channels=pickerChannels(), list=$('picker-list');list.replaceChildren();
    const profile=state.settings.profiles.find(p=>p.id===picker.profileId);
    const enabled=new Set(profile?.channels.filter(c=>c.enabled).map(c=>c.id)||[]);
    for(const channel of channels){
      const label=document.createElement('label');label.className='picker-channel';
      const check=document.createElement('input');check.type='checkbox';check.checked=enabled.has(channel.id)||picker.selected.has(channel.id);check.disabled=enabled.has(channel.id)||picker.busy;check.setAttribute('aria-label',`Select ${channel.name}`);
      const info=document.createElement('span');info.className='channel-info';const name=document.createElement('strong');name.textContent=channel.name;const handle=document.createElement('span');handle.textContent=enabled.has(channel.id)?'Already enabled in this profile':channel.handle||channel.id;info.append(name,handle);
      check.onchange=()=>{if(check.checked)picker.selected.add(channel.id);else picker.selected.delete(channel.id);updatePickerSelection();};
      label.append(check,avatarFor(channel),info);list.append(label);
    }
    const total=picker.catalog?.channels.length||0;
    $('picker-count').textContent=picker.loading?'Loading channels…':`${channels.length} of ${total} channels`;
    $('picker-status').hidden=channels.length>0&&!picker.error;
    $('picker-status').classList.toggle('is-error',!!picker.error);
    $('picker-status').textContent=picker.loading?'Loading channels from YouTube…':picker.error||(!total?(picker.source==='search'?'No matching channels found. Try an @handle or a more specific name.':'No subscriptions found. Check the YouTube account in this browser, then refresh.'):'No channels match this search.');
    $('picker-select-visible').disabled=picker.loading||picker.busy||!channels.some(c=>!enabled.has(c.id));
    $('picker-clear').disabled=picker.busy||!picker.selected.size;
    $('picker-refresh').disabled=picker.loading||picker.busy;
    $('picker-back').disabled=picker.busy;
    $('picker-list').setAttribute('aria-busy', String(picker.loading));
    updatePickerSelection();
  }
  function updatePickerSelection(){
    if(!picker)return;
    $('picker-selection').textContent=`${picker.selected.size} channel${picker.selected.size===1?'':'s'} selected`;
    $('picker-add').disabled=picker.loading||picker.busy||!picker.selected.size;
    $('picker-clear').disabled=picker.busy||!picker.selected.size;
    $('picker-add').textContent=picker.busy?'Adding channels…':'Add selected channels';
  }
  async function loadPicker(){
    if (!picker || picker.busy) return;
    const request=++pickerRequest, current=picker;
    current.loading=true;current.error='';current.catalog=null;current.selected.clear();renderPicker();
    try{
      const reply=await UI.send(current.source==='subscriptions'?'subscriptions.list':'channel.search',current.source==='search'?{query:current.query}:{});
      if(picker!==current||request!==pickerRequest)return;
      current.catalog=reply.catalog;
    }catch(error){if(picker===current&&request===pickerRequest)current.error=error.message;}
    finally{if(picker===current&&request===pickerRequest){current.loading=false;renderPicker();}}
  }
  async function openPicker(source,query=''){
    const profile=C.activeProfile(state.settings);
    picker={profileId:profile.id,source,query,selected:new Set(),catalog:null,loading:true,busy:false,error:''};
    $('picker-title').textContent=source==='subscriptions'?'Your subscriptions':'Matching channels';
    $('picker-back').hidden=source==='subscriptions';
    $('picker-profile').textContent=`Add to ${profile.name}${query?` · Results for “${query}”`:''}`;
    $('picker-account').hidden=source!=='subscriptions';$('picker-filter').value='';
    if (source === 'search') $('channel-picker').scrollIntoView({block:'nearest',behavior:'smooth'});
    await loadPicker();
  }
  UI.on('picker-back','click',()=>openPicker('subscriptions'));
  UI.on('picker-filter','input',renderPicker);
  UI.on('picker-refresh','click',loadPicker);
  UI.on('picker-open-youtube','click',()=>UI.send('page.subscriptions'));
  UI.on('picker-select-visible','click',()=>{
    if(!picker)return;
    const profile=state.settings.profiles.find(p=>p.id===picker.profileId);
    for(const channel of pickerChannels())if(!profile?.channels.some(c=>c.id===channel.id&&c.enabled))picker.selected.add(channel.id);
    renderPicker();
  });
  UI.on('picker-clear','click',()=>{picker.selected.clear();renderPicker();});
  UI.on('picker-add','click',async()=>{
    if(!picker?.selected.size||picker.busy)return;
    const current=picker;current.busy=true;renderPicker();
    const channelIds=[...current.selected], profileId=current.profileId;
    try{
      await UI.action('channel.addMany',{profileId,catalogId:current.catalog.id,channelIds});
      if(picker===current){current.busy=false;current.selected.clear();renderPicker();}
      UI.notice(`${channelIds.length} channel${channelIds.length===1?'':'s'} added to your profile.`);
      UI.send('channel.images').catch(()=>{});
    }
    catch(error){if(picker===current){current.busy=false;current.error=error.message;renderPicker();}}
  });
  UI.on('new-profile', 'click', () => openDialog('create'));
  UI.on('rename-profile', 'click', () => openDialog('rename'));
  UI.on('duplicate-profile', 'click', () => openDialog('duplicate'));
  UI.on('dialog-cancel', 'click', () => $('profile-dialog').close());
  UI.on('profile-form', 'submit', async e => {
    e.preventDefault();
    const name = C.cleanName($('profile-input').value), profileId = state.settings.activeProfileId;
    if (dialogAction === 'rename') await UI.action('profile.rename', { name, profileId });
    else await UI.action('profile.create', { name, copyFrom: dialogAction === 'duplicate' ? profileId : undefined });
    $('profile-dialog').close();
  });
  UI.on('delete-profile', 'click', async () => {
    const profile = C.activeProfile(state.settings);
    if (!confirm(`Delete “${profile.name}” and its channel selection?`)) return;
    await UI.action('profile.delete', { profileId: profile.id });
  });
  UI.on('add-channel-form', 'submit', async e => {
    e.preventDefault(); if (adding) return;
    adding = true; $('add-channel').disabled = true; $('add-channel').textContent = 'Verifying…';
    const profileId = state.settings.activeProfileId;
    try {
      const input=$('channel-input').value.trim();
      if(input.startsWith('@')||/^https?:\/\//i.test(input)||/^(www\.)?youtube\.com\//i.test(input)||C.CHANNEL_ID.test(input)){
        await UI.action('channel.add', { profileId, input }); $('channel-input').value = ''; UI.notice('Channel added to your profile.');
      }else await openPicker('search',input);
    }
    finally { adding = false; $('add-channel').disabled = false; $('add-channel').textContent = 'Add channel'; }
  });
  UI.on('hide-shorts', 'change', async () => { try { await UI.action('settings.shorts', { hidden: $('hide-shorts').checked }); } catch (error) { $('hide-shorts').checked = state.settings.hideShorts; throw error; } });
  UI.on('return-focus', 'click', () => UI.action('mode.focus'));
  const prefill = new URLSearchParams(location.search).get('channel');
  if (prefill) { try { $('channel-input').value = C.channelInput(prefill); } catch { /* ignore untrusted query */ } }
  UI.watch(render); UI.refresh().then(next=>{if(next){openPicker('subscriptions');UI.send('channel.images').catch(()=>{});}});
  setInterval(() => { if (state?.mode === 'standard') UI.refresh(); }, 15000);
})();
