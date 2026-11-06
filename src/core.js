/* Shared pure logic. No remote code or dependencies. */
(() => {
  'use strict';
  const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
  const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  const SENTENCES = [
    'I choose this break deliberately.', 'My attention deserves a purpose.',
    'I can return to learning.', 'One video can be enough.',
    'I decide what happens next.', 'My time belongs to me.',
    'Curiosity works best with direction.', 'I will notice my choices.',
    'Small pauses help me choose.', 'Useful ideas deserve my attention.',
    'I can stop whenever needed.', 'Today I choose with intention.',
    'Every moment offers another choice.', 'Learning grows through steady practice.',
    'My plans leave room for discovery.',
  ].filter(s => s.split(/\s+/).length === 5);
  function id() { return crypto.randomUUID(); }
  function newProfile(name = 'Learning') {
    return { id: id(), name: cleanName(name), channels: [] };
  }
  function cleanName(value) {
    const name = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 60) throw new Error('Use a profile name between 1 and 60 characters.');
    return name;
  }
  function defaults() {
    const profile = newProfile();
    return { version: 1, profiles: [profile], activeProfileId: profile.id, hideShorts: true };
  }
  function channelInput(value) {
    let text = String(value ?? '').trim();
    if (CHANNEL_ID.test(text)) text = `https://www.youtube.com/channel/${text}`;
    else if (text.startsWith('@')) text = `https://www.youtube.com/${text}`;
    else if (/^(www\.)?youtube\.com\//i.test(text)) text = `https://${text}`;
    let url;
    try { url = new URL(text); } catch { throw new Error('Paste a YouTube channel URL or @handle.'); }
    if (!['www.youtube.com', 'youtube.com'].includes(url.hostname) || url.protocol !== 'https:' || url.username || url.password || url.port) {
      throw new Error('Use an https://www.youtube.com channel URL or @handle.');
    }
    let parts;
    try { parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); } catch { throw new Error('Invalid channel URL.'); }
    const [first, second] = parts;
    if (first?.startsWith('@') && /^@[\p{L}\p{N}\p{M}_.\-·]{1,100}$/u.test(first)) {
      return `https://www.youtube.com/${encodeURI(first)}`;
    }
    if (first === 'channel' && CHANNEL_ID.test(second || '')) return `https://www.youtube.com/channel/${second}`;
    if (['c', 'user'].includes(first) && /^[\p{L}\p{N}\p{M}_.-]{1,100}$/u.test(second || '')) {
      return `https://www.youtube.com/${first}/${encodeURIComponent(second)}`;
    }
    throw new Error('That is not a channel URL. Use a /@handle or /channel/UC… link.');
  }
  function identity(value) {
    try {
      const path = new URL(channelInput(value)).pathname;
      return decodeURIComponent(path).replace(/\/$/, '').toLowerCase();
    } catch { return null; }
  }
  function activeProfile(settings) {
    return settings.profiles.find(p => p.id === settings.activeProfileId) || settings.profiles[0];
  }
  function selectedChannels(settings) { return activeProfile(settings)?.channels.filter(c => c.enabled !== false) || []; }
  function allowsChannel(settings, channelId) {
    return !!channelId && selectedChannels(settings).some(c => c.id === channelId);
  }
  function allowsIdentity(settings, value) {
    const key = identity(value);
    if (!key) return false;
    return selectedChannels(settings).some(c => [c.url, c.handle, ...(c.aliases || [])].some(v => identity(v) === key));
  }
  function normalizePassage(value) { return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function randomBelow(max) {
    const range = 0x100000000;
    const limit = range - (range % max);
    let value;
    do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
    return value % max;
  }
  function makePassage(previous = '') {
    let passage;
    do {
      const bank = [...SENTENCES];
      for (let i = bank.length - 1; i > 0; i--) {
        const j = randomBelow(i + 1); [bank[i], bank[j]] = [bank[j], bank[i]];
      }
      passage = bank.slice(0, 2 + randomBelow(2)).join(' ');
    } while (passage === previous);
    return passage;
  }
  function matchedWords(input, passage) {
    const typed = normalizePassage(input).split(' '), target = normalizePassage(passage).split(' ');
    let count = 0;
    while (count < target.length && typed[count] === target[count]) count++;
    return count;
  }
  function standardActive(until, now = Date.now()) { return Number.isFinite(until) && until > now; }
  function videoId(value) {
    try {
      const url = new URL(value, 'https://www.youtube.com');
      if (!['www.youtube.com', 'youtube.com'].includes(url.hostname)) return null;
      const candidate = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|live)\/([^/]+)/)?.[1];
      return VIDEO_ID.test(candidate || '') ? candidate : null;
    } catch { return null; }
  }
  // Extract JSON without evaluating YouTube's scripts. Handles nested braces and escaped quotes.
  function jsonObjectAfter(text, marker) {
    const at = text.indexOf(marker);
    if (at < 0) return null;
    const start = text.indexOf('{', at + marker.length);
    if (start < 0 || start - at - marker.length > 10) return null;
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
    return null;
  }
  function parseChannelPage(html, inputUrl) {
    const metadata = jsonObjectAfter(html, '"channelMetadataRenderer":');
    if (!metadata || !CHANNEL_ID.test(metadata.externalId || '')) {
      throw new Error('YouTube did not return channel details. Check the URL and try again.');
    }
    const url = `https://www.youtube.com/channel/${metadata.externalId}`;
    const handleUrl = metadata.vanityChannelUrl || metadata.channelUrl || '';
    const aliases = [...new Set([inputUrl, handleUrl, url].map(v => { try { return channelInput(v); } catch { return null; } }).filter(Boolean))];
    const handle = aliases.map(v => new URL(v).pathname).find(v => v.startsWith('/@'))?.slice(1) || '';
    return { id: metadata.externalId, name: String(metadata.title || handle || metadata.externalId).slice(0, 160), url, handle: decodeURI(handle), aliases, thumbnail: thumbnailUrl(metadata.avatar?.thumbnails?.at(-1)?.url), enabled: true };
  }
  function thumbnailUrl(value) {
    try {
      const url = new URL(value?.startsWith('//') ? `https:${value}` : value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
      return /^(?:yt\d+\.(?:ggpht|googleusercontent)\.com|i\.ytimg\.com)$/.test(url.hostname) ? url.href : '';
    } catch { return ''; }
  }
  function pageData(html) {
    for (const marker of ['var ytInitialData =', 'window["ytInitialData"] =', "window['ytInitialData'] =", 'ytInitialData =']) {
      const data = jsonObjectAfter(html, marker);
      if (data) return data;
    }
    throw new Error('YouTube did not return its channel list. Reload YouTube and try again.');
  }
  function catalogFromData(data) {
    const channels = new Map(), stack = [data.contents || data];
    let continuation = '', visited = 0;
    while (stack.length && visited++ < 250000) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      const renderer = node.channelRenderer;
      if (renderer && CHANNEL_ID.test(renderer.channelId || '')) {
        const url = `https://www.youtube.com/channel/${renderer.channelId}`;
        const base = renderer.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl;
        let alias = '';
        try { alias = channelInput(new URL(base, 'https://www.youtube.com').href); } catch { /* optional alias */ }
        channels.set(renderer.channelId, {
          id: renderer.channelId,
          name: String(renderer.title?.simpleText || renderer.title?.runs?.map(run => run.text).join('') || renderer.channelId).slice(0,160),
          url, handle: alias.includes('/@') ? decodeURI(new URL(alias).pathname.slice(1)) : '',
          aliases: alias ? [url, alias] : [url],
          thumbnail: thumbnailUrl(renderer.thumbnail?.thumbnails?.at(-1)?.url), enabled: true,
        });
        continue;
      }
      const token = node.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (typeof token === 'string' && token.length < 20000) continuation = token;
      for (const value of Object.values(node)) if (value && typeof value === 'object') stack.push(value);
    }
    return { channels: [...channels.values()].sort((a,b) => a.name.localeCompare(b.name)), continuation };
  }
  function parseVideoPage(html, expectedId) {
    const details = jsonObjectAfter(html, '"videoDetails":');
    if (!details || details.videoId !== expectedId || !CHANNEL_ID.test(details.channelId || '')) {
      throw new Error('Could not verify this video’s channel.');
    }
    return { videoId: expectedId, channelId: details.channelId };
  }
  const api = { CHANNEL_ID, VIDEO_ID, SENTENCES, id, newProfile, cleanName, defaults, channelInput, identity, activeProfile, selectedChannels, allowsChannel, allowsIdentity, normalizePassage, makePassage, matchedWords, standardActive, videoId, jsonObjectAfter, parseChannelPage, parseVideoPage, thumbnailUrl, pageData, catalogFromData };
  globalThis.FocusCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
