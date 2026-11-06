const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
async function harness(options={}) {
  const stores = { local: {}, session: {} }, alarms = new Map(), listeners = {}, messages = [];
  const area = key => ({
    async get(name) { return { [name]: structuredClone(stores[key][name]) }; },
    async set(data) { Object.assign(stores[key], structuredClone(data)); },
    async setAccessLevel() {},
  });
  const chrome = {
    runtime: { id: 'test-id', getURL: value => `chrome-extension://test-id/${value}`, onMessage: { addListener(fn) { listeners.message = fn; } }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    storage: { local: area('local'), session: area('session') },
    action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} },
    alarms: { async create(name, data) { alarms.set(name, data); }, async clear(name) { alarms.delete(name); }, onAlarm: { addListener(fn) { listeners.alarm = fn; } } },
    tabs: { async query() { return options.noYouTubeTabs?[]:[{ id: 1 }]; }, async sendMessage(id, data) { messages.push(data);if(data.type==='subscriptions.read')return options.subscriptionReply||{ok:true,channels:[]}; }, async create() {} },
  };
  const context = vm.createContext({ chrome, console, crypto: webcrypto, structuredClone, URL, AbortSignal, setTimeout, clearTimeout,
    fetch: async url => ({ ok: true, url, text: async () => url.includes('/results?') ? `var ytInitialData = ${JSON.stringify({contents:{channelRenderer:{channelId:A,title:{simpleText:'Example channel'}}}})};` : url.includes('/watch') ? JSON.stringify({ videoDetails: { videoId: new URL(url).searchParams.get('v'), channelId: A } }) : JSON.stringify({ channelMetadataRenderer: { externalId: A, title: 'Example channel', vanityChannelUrl: 'https://www.youtube.com/@example' } }) }),
  });
  context.importScripts = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8'), context);
  const extension = { id: 'test-id', url: 'chrome-extension://test-id/app.html' };
  const content = { id: 'test-id', url: 'https://www.youtube.com/' };
  const send = (type, payload = {}, sender = extension) => new Promise(resolve => listeners.message({ type, ...payload }, sender, resolve));
  return { send, stores, alarms, listeners, messages, content };
}
test('concurrent profile mutations do not lose updates; switching applies only one profile', async () => {
  const h = await harness();
  const initial = await h.send('state.get'); assert.equal(initial.state.mode, 'focus');
  const replies = await Promise.all([h.send('profile.create', { name: 'Science' }), h.send('profile.create', { name: 'Design' })]);
  assert.ok(replies.every(r => r.ok));
  const state = (await h.send('state.get')).state; assert.equal(state.settings.profiles.length, 3);
  const science = state.settings.profiles.find(p => p.name === 'Science');
  await h.send('channel.add', { profileId: science.id, input: '@example' });
  await h.send('profile.activate', { profileId: science.id });
  const result = (await h.send('state.get')).state;
  assert.equal(result.settings.activeProfileId, science.id);
  assert.equal(result.settings.profiles.find(p => p.id === science.id).channels[0].id, A);
  assert.equal(result.settings.profiles.find(p => p.name === 'Design').channels.length, 0);
  assert.ok(h.messages.length > 0);
});
test('unlock requires the current full passage, is one-use, and returns safely to focus', async () => {
  const h = await harness();
  const { challenge } = await h.send('challenge.create');
  assert.ok([2, 3].includes(challenge.passage.match(/\./g).length));
  assert.equal((await h.send('challenge.submit', { challengeId: challenge.id, text: 'no', minutes: 15 })).ok, false);
  assert.equal((await h.send('challenge.submit', { challengeId: challenge.id, text: challenge.passage.split('. ')[0] + '.', minutes: 15 })).ok, false);
  assert.equal((await h.send('state.get')).state.mode, 'focus');
  assert.equal((await h.send('challenge.submit', { challengeId: challenge.id, text: challenge.passage, minutes: 15 })).ok, true);
  assert.equal((await h.send('state.get')).state.mode, 'standard');
  assert.ok(h.alarms.has('focus-break-ended'));
  assert.equal((await h.send('challenge.submit', { challengeId: challenge.id, text: challenge.passage, minutes: 15 })).ok, false);
  await h.send('mode.focus', {}, h.content);
  assert.equal((await h.send('state.get')).state.mode, 'focus');
  assert.equal(h.alarms.has('focus-break-ended'), false);
  const next = (await h.send('challenge.create')).challenge; assert.notEqual(next.passage, challenge.passage);
});
test('stale challenges, invalid durations, and untrusted mode changes cannot unlock', async () => {
  const h = await harness();
  const first = (await h.send('challenge.create')).challenge;
  const current = (await h.send('challenge.create')).challenge;
  assert.equal((await h.send('challenge.submit', { challengeId: first.id, text: first.passage, minutes: 15 })).ok, false);
  assert.equal((await h.send('challenge.submit', { challengeId: current.id, text: current.passage, minutes: 999 })).ok, false);
  assert.equal((await h.send('challenge.submit', { challengeId: current.id, text: current.passage, minutes: 15 }, h.content)).ok, false);
  h.stores.session.focusSession.challenge.createdAt -= 31 * 60_000;
  assert.equal((await h.send('challenge.submit', { challengeId: current.id, text: current.passage, minutes: 15 })).ok, false);
  assert.equal((await h.send('profile.create', { name: 'Bypass' }, h.content)).ok, false);
});
test('profile switching exits standard mode and cancels outstanding challenges', async () => {
  const h = await harness();
  const initial = (await h.send('state.get')).state;
  const { challenge } = await h.send('challenge.create');
  await h.send('challenge.submit', { challengeId: challenge.id, text: challenge.passage, minutes: 30 });
  await h.send('profile.activate', { profileId: initial.settings.activeProfileId });
  assert.equal((await h.send('state.get')).state.mode, 'focus');
  assert.equal(h.stores.session.focusSession.challenge, undefined);
});
test('expired modes and browser restart default to focus, with empty lists kept closed', async () => {
  const h = await harness();
  h.stores.session.focusSession = { standardUntil: Date.now() - 1 };
  assert.equal((await h.send('state.get')).state.mode, 'focus');
  h.stores.session = {};
  const state = (await h.send('state.get')).state;
  assert.equal(state.mode, 'focus'); assert.equal(state.settings.profiles[0].channels.length, 0);
  assert.equal((await h.send('profile.delete', { profileId: state.settings.activeProfileId })).ok, false);
});
test('duplicated profiles have independent selections and support rename and deletion', async () => {
  const h = await harness();
  const original = (await h.send('state.get')).state.settings.profiles[0];
  await h.send('channel.add', { profileId: original.id, input: '@example' });
  const reply = await h.send('profile.create', { name: 'Copy', copyFrom: original.id });
  const copiedId = reply.state.settings.activeProfileId;
  await h.send('channel.toggle', { profileId: copiedId, channelId: A, enabled: false });
  await h.send('profile.rename', { profileId: copiedId, name: 'Renamed copy' });
  const settings = (await h.send('state.get')).state.settings;
  assert.equal(settings.profiles.find(p => p.id === original.id).channels[0].enabled, true);
  assert.equal(settings.profiles.find(p => p.id === copiedId).channels[0].enabled, false);
  assert.equal(settings.profiles.find(p => p.id === copiedId).name, 'Renamed copy');
  await h.send('profile.delete', { profileId: copiedId });
  const after = (await h.send('state.get')).state.settings;
  assert.equal(after.profiles.length, 1); assert.equal(after.activeProfileId, original.id);
});
test('challenge freshness survives clearing temporary browser-session state', async () => {
  const h = await harness();
  const first = (await h.send('challenge.create')).challenge;
  assert.equal(h.stores.local.lastUnlockPassage, first.passage);
  h.stores.session = {};
  const next = (await h.send('challenge.create')).challenge;
  assert.notEqual(next.passage, first.passage);
  assert.equal(h.stores.local.lastUnlockPassage, next.passage);
});
test('subscription bulk selection is additive, deduplicated, and isolated to the chosen profile', async () => {
  const B='UCbbbbbbbbbbbbbbbbbbbbbb';
  const h=await harness({subscriptionReply:{ok:true,channels:[{id:A,name:'Channel A',thumbnail:'https://yt3.ggpht.com/a=s88'},{id:B,name:'Channel B',thumbnail:'https://evil.test/pixel'}]}});
  const first=(await h.send('state.get')).state.settings.profiles[0];
  await h.send('profile.create',{name:'Other'});
  const {catalog}=await h.send('subscriptions.list');
  assert.equal(catalog.channels.length,2);
  assert.equal(catalog.channels.find(c=>c.id===B).thumbnail,'');
  const added=await h.send('channel.addMany',{profileId:first.id,catalogId:catalog.id,channelIds:[A,A,B]});
  assert.equal(added.ok,true);
  assert.equal(added.state.settings.profiles.find(p=>p.id===first.id).channels.length,2);
  assert.equal(added.state.settings.profiles.find(p=>p.name==='Other').channels.length,0);
  await h.send('channel.toggle',{profileId:first.id,channelId:A,enabled:false});
  await h.send('channel.addMany',{profileId:first.id,catalogId:catalog.id,channelIds:[A]});
  const after=(await h.send('state.get')).state.settings.profiles.find(p=>p.id===first.id);
  assert.equal(after.channels.length,2);assert.equal(after.channels.find(c=>c.id===A).enabled,true);
});
test('bulk selection rejects unlisted IDs, expired lists, and page-origin writes atomically', async () => {
  const h=await harness({subscriptionReply:{ok:true,channels:[{id:A,name:'Example'}]}});
  const profile=(await h.send('state.get')).state.settings.profiles[0];
  const {catalog}=await h.send('subscriptions.list');
  assert.equal((await h.send('channel.addMany',{profileId:profile.id,catalogId:catalog.id,channelIds:[A,'UCbbbbbbbbbbbbbbbbbbbbbb']})).ok,false);
  assert.equal((await h.send('state.get')).state.settings.profiles[0].channels.length,0);
  assert.equal((await h.send('subscriptions.list',{},h.content)).ok,false);
  assert.equal((await h.send('channel.addMany',{profileId:profile.id,catalogId:catalog.id,channelIds:[A]},h.content)).ok,false);
  h.stores.session.focusCatalogs[0].createdAt-=31*60_000;
  assert.equal((await h.send('channel.addMany',{profileId:profile.id,catalogId:catalog.id,channelIds:[A]})).ok,false);
});
test('subscription errors remain actionable and channel-name search uses verified results', async () => {
  const absent=await harness({noYouTubeTabs:true});
  const unavailable=await absent.send('subscriptions.list');
  assert.equal(unavailable.ok,false);assert.match(unavailable.error,/sign in/);
  const loggedOut=await harness({subscriptionReply:{ok:false,error:'Sign in to YouTube first.'}});
  assert.equal((await loggedOut.send('subscriptions.list')).ok,false);
  const h=await harness();const profile=(await h.send('state.get')).state.settings.profiles[0];
  const found=await h.send('channel.search',{query:'Example channel'});
  assert.equal(found.catalog.channels[0].id,A);
  assert.equal((await h.send('channel.addMany',{profileId:profile.id,catalogId:found.catalog.id,channelIds:[A]})).ok,true);
});
