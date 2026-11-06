(() => {
  const UI = FocusUI, C = FocusCore, $ = id => document.getElementById(id);
  function render(state) {
    const select = $('popup-profile'); select.replaceChildren();
    state.settings.profiles.forEach(profile => { const option = new Option(profile.name, profile.id); select.append(option); });
    select.value = state.settings.activeProfileId;
    const count = C.selectedChannels(state.settings).length;
    $('popup-summary').textContent = `${count} selected channel${count === 1 ? '' : 's'} · ${state.settings.hideShorts ? 'Shorts hidden in feeds' : 'Shorts allowed from selected channels'}`;
    const standard = state.mode === 'standard';
    $('mode-badge').textContent = standard ? `Standard · ${UI.remaining(state.standardUntil)} min left` : 'Focus mode';
    $('mode-badge').classList.toggle('standard', standard); $('focus').hidden = !standard; $('standard').hidden = standard;
  }
  UI.on('popup-profile', 'change', () => UI.action('profile.activate', { profileId: $('popup-profile').value }));
  UI.on('manage', 'click', () => UI.send('page.manager'));
  UI.on('standard', 'click', () => UI.send('page.unlock'));
  UI.on('focus', 'click', () => UI.action('mode.focus'));
  UI.watch(render); UI.refresh();
})();
