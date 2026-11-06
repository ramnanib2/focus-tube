(() => {
  'use strict';
  let refreshTimer;
  const listeners = new Set();
  async function send(type, payload = {}) {
    if (!globalThis.chrome?.runtime?.id) throw new Error('Load Focus Tube as an unpacked Chrome extension to use these controls.');
    const reply = await chrome.runtime.sendMessage({ type, ...payload });
    if (!reply?.ok) throw new Error(reply?.error || 'The extension could not complete this action.');
    return reply;
  }
  function notice(message, error = false) {
    const el = document.getElementById('notice');
    if (!el) return;
    el.hidden = false; el.textContent = message; el.classList.toggle('is-error', error);
    clearTimeout(notice.timer);
    notice.timer = setTimeout(() => { el.hidden = true; }, error ? 12000 : 4500);
  }
  async function refresh() {
    try { const { state } = await send('state.get'); listeners.forEach(listener => listener(state)); return state; }
    catch (error) { notice(error.message, true); return null; }
  }
  async function action(type, payload) {
    const reply = await send(type, payload);
    if (reply.state) listeners.forEach(listener => listener(reply.state));
    return reply;
  }
  function watch(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function on(id, event, handler) {
    document.getElementById(id)?.addEventListener(event, async e => {
      try { await handler(e); } catch (error) { notice(error.message, true); }
    });
  }
  function remaining(until) { return Math.max(1, Math.ceil((until - Date.now()) / 60000)); }
  if (globalThis.chrome?.storage?.onChanged) chrome.storage.onChanged.addListener(() => {
    clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 80);
  });
  globalThis.FocusUI = { send, action, notice, refresh, watch, on, remaining };
})();
