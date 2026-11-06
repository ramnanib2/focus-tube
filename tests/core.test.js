const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core');
const A = 'UCaaaaaaaaaaaaaaaaaaaaaa', B = 'UCbbbbbbbbbbbbbbbbbbbbbb';
test('channel input canonicalizes handles, IDs, and channel subpages without accepting other sites', () => {
  assert.equal(C.channelInput('@3blue1brown'), 'https://www.youtube.com/@3blue1brown');
  assert.equal(C.channelInput(A), `https://www.youtube.com/channel/${A}`);
  assert.equal(C.channelInput('youtube.com/@Veritasium/videos?view=0'), 'https://www.youtube.com/@Veritasium');
  assert.equal(C.channelInput(`https://youtube.com/channel/${A}/videos`), `https://www.youtube.com/channel/${A}`);
  for (const value of ['https://evil.test/@person', 'https://youtube.com.evil.test/@person', 'https://www.youtube.com/watch?v=aaaaaaaaaaa', 'https://person@youtube.com/@person', 'javascript:alert(1)', 'http://youtube.com/@person', 'https://youtube.com:8443/@person', 'https://youtube.com/@%2fchannel']) assert.throws(() => C.channelInput(value));
});
test('profile selection is strict by channel ID and never uses topic matching', () => {
  const settings = C.defaults(), first = settings.profiles[0];
  first.channels = [{ id: A, enabled: true }, { id: B, enabled: false }];
  assert.equal(C.allowsChannel(settings, A), true);
  assert.equal(C.allowsChannel(settings, B), false);
  const second = C.newProfile('Music'); second.channels = [{ id: B, enabled: true }]; settings.profiles.push(second); settings.activeProfileId = second.id;
  assert.equal(C.allowsChannel(settings, A), false);
  assert.equal(C.allowsChannel(settings, B), true);
  second.channels = []; assert.equal(C.allowsChannel(settings, A), false);
});
test('challenges have two or three short sentences and change for each attempt', () => {
  let previous = '';
  for (let i = 0; i < 200; i++) {
    const passage = C.makePassage(previous);
    const sentences = passage.match(/[^.]+\./g);
    assert.ok(sentences.length === 2 || sentences.length === 3);
    assert.equal(new Set(sentences.map(s => s.trim())).size, sentences.length);
    const words = passage.split(/\s+/).length;
    assert.ok(words >= 10 && words <= 15);
    assert.notEqual(passage, previous); previous = passage;
    assert.equal(C.matchedWords(passage, passage), words);
  }
  assert.equal(C.normalizePassage('  A\n B   c '), 'a b c');
  assert.equal(C.matchedWords('I choose this', 'I choose this break deliberately.'), 3);
});
test('standard mode expires at the boundary, including invalid stored values', () => {
  assert.equal(C.standardActive(1001, 1000), true);
  assert.equal(C.standardActive(1000, 1000), false);
  assert.equal(C.standardActive(NaN, 1000), false);
  assert.equal(C.standardActive('2000', 1000), false);
});
test('metadata extraction handles nested braces, escaped quotes and wrong video responses', () => {
  const metadata = { externalId: A, title: 'A "quoted" {channel}', vanityChannelUrl: 'https://www.youtube.com/@example' };
  const html = `before {"channelMetadataRenderer":${JSON.stringify(metadata)}} after`;
  const channel = C.parseChannelPage(html, 'https://www.youtube.com/@example');
  assert.equal(channel.id, A); assert.equal(channel.name, metadata.title); assert.equal(channel.handle, '@example');
  assert.throws(() => C.parseChannelPage('<title>Consent</title>', '@example'));
  const details = { videoId: 'aaaaaaaaaaa', channelId: A };
  assert.equal(C.parseVideoPage(`{"videoDetails":${JSON.stringify(details)}}`, details.videoId).channelId, A);
  assert.throws(() => C.parseVideoPage(`{"videoDetails":${JSON.stringify(details)}}`, 'bbbbbbbbbbb'));
  assert.equal(C.jsonObjectAfter('prefix "target": {oops}', '"target":'), null);
});
test('video IDs are extracted only from supported YouTube URLs', () => {
  assert.equal(C.videoId('/watch?v=aaaaaaaaaaa&list=test'), 'aaaaaaaaaaa');
  assert.equal(C.videoId('https://www.youtube.com/shorts/bbbbbbbbbbb'), 'bbbbbbbbbbb');
  assert.equal(C.videoId('https://evil.test/watch?v=aaaaaaaaaaa'), null);
  assert.equal(C.videoId('/watch?v=short'), null);
});
test('subscription and name-search catalogs parse IDs, images, titles and continuation pages', () => {
  const renderer={channelId:A,title:{simpleText:'Example {channel}'},navigationEndpoint:{browseEndpoint:{canonicalBaseUrl:'/@example'}},thumbnail:{thumbnails:[{url:'https://yt3.ggpht.com/avatar=s88'}]}};
  const data={contents:{items:[{channelRenderer:renderer},{channelRenderer:renderer},{videoRenderer:{videoId:'aaaaaaaaaaa'}},{channelRenderer:{channelId:B,title:{runs:[{text:'Another '},{text:'creator'}]},thumbnail:{thumbnails:[{url:'https://evil.test/pixel'}]}}},{continuationItemRenderer:{continuationEndpoint:{continuationCommand:{token:'next-page'}}}}]}};
  const html=`<script>var ytInitialData = ${JSON.stringify(data)};</script>`;
  const catalog=C.catalogFromData(C.pageData(html));
  assert.equal(catalog.channels.length,2);
  assert.equal(catalog.continuation,'next-page');
  const channel=catalog.channels.find(c=>c.id===A);
  assert.equal(channel.handle,'@example');assert.equal(channel.name,'Example {channel}');
  assert.equal(channel.thumbnail,'https://yt3.ggpht.com/avatar=s88');
  assert.equal(catalog.channels.find(c=>c.id===B).thumbnail,'');
  const continuation=C.catalogFromData({onResponseReceivedActions:[{appendContinuationItemsAction:{continuationItems:[{channelRenderer:renderer}]}}]});
  assert.equal(continuation.channels[0].id,A);
  assert.throws(()=>C.pageData('<title>Please sign in</title>'));
});
test('thumbnail links accept only HTTPS YouTube image hosts', () => {
  assert.equal(C.thumbnailUrl('//yt3.googleusercontent.com/avatar=s176'),'https://yt3.googleusercontent.com/avatar=s176');
  for(const value of ['javascript:alert(1)','http://yt3.ggpht.com/x','https://yt3.ggpht.com.evil.test/x','https://me@yt3.ggpht.com/x','https://evil.test/track',undefined])assert.equal(C.thumbnailUrl(value),'');
});
