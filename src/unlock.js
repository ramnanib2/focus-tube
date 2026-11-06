(() => {
  'use strict';
  const UI = FocusUI, C = FocusCore, $ = id => document.getElementById(id);
  let challenge = null, submitting = false, totalWords = 0;
  function render(state) {
    $('unlock-profile').textContent = C.activeProfile(state.settings).name;
    const standard = state.mode === 'standard';
    $('challenge-section').hidden = standard; $('unlocked-section').hidden = !standard;
    $('unlocked-message').textContent = `Your selected profile returns in ${UI.remaining(state.standardUntil)} minutes. You can return sooner whenever you like.`;
  }
  async function generate() {
    $('passage-entry').disabled = true; $('unlock').disabled = true; $('regenerate').disabled = true;
    try {
      const reply = await UI.send('challenge.create'); challenge = reply.challenge;
      totalWords = C.normalizePassage(challenge.passage).split(' ').length;
      $('passage').textContent = challenge.passage; $('passage-entry').value = '';
      $('progress').textContent = `0 / ${totalWords} words matched`; $('progress-fill').style.width = '0%';
      $('passage-entry').disabled = false;
    } finally { $('regenerate').disabled = false; }
  }
  UI.on('passage-entry', 'input', () => {
    if (!challenge) return;
    const text = $('passage-entry').value, matched = C.matchedWords(text, challenge.passage);
    $('progress').textContent = `${matched} / ${totalWords} words matched`;
    $('progress-fill').style.width = `${matched / totalWords * 100}%`;
    $('unlock').disabled = submitting || C.normalizePassage(text) !== C.normalizePassage(challenge.passage);
  });
  const noPaste = e => { e.preventDefault(); UI.notice('Please type the passage. The pause is part of the switch.'); };
  $('passage-entry').addEventListener('paste', noPaste);
  $('passage-entry').addEventListener('drop', noPaste);
  $('passage-entry').addEventListener('beforeinput', e => { if (['insertFromPaste', 'insertFromDrop'].includes(e.inputType)) noPaste(e); });
  UI.on('regenerate', 'click', generate);
  UI.on('stay', 'click', async () => {
    if (challenge) await UI.send('challenge.cancel', { challengeId: challenge.id });
    await UI.action('mode.focus'); location.href = 'app.html';
  });
  UI.on('end-break', 'click', async () => { await UI.action('mode.focus'); await generate(); });
  UI.on('unlock-form', 'submit', async e => {
    e.preventDefault(); if (submitting || !challenge) return;
    submitting = true; $('unlock').disabled = true;
    try { await UI.action('challenge.submit', { challengeId: challenge.id, text: $('passage-entry').value, minutes: Number($('duration').value) }); challenge = null; $('passage-entry').value = ''; }
    finally { submitting = false; }
  });
  UI.watch(render);
  UI.refresh().then(state => { if (state?.mode === 'focus') generate().catch(error => UI.notice(error.message, true)); });
  setInterval(() => UI.refresh(), 15000);
})();
