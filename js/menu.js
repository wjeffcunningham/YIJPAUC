// Menu settings: keep the two magnify switches in step, and remember
// each toggle's state on this device.

document.addEventListener('DOMContentLoaded', () => {
  const menuMagnify = document.getElementById('toggle-pa');
  const mainMagnify = document.getElementById('magnify-toggle');
  if (menuMagnify && mainMagnify) {
    menuMagnify.addEventListener('change', () => { mainMagnify.checked = menuMagnify.checked; });
    mainMagnify.addEventListener('change', () => { menuMagnify.checked = mainMagnify.checked; });
  }

  // The radar setting was saved as 'game-toggle' before it was renamed.
  if (localStorage.getItem('tracker-toggle') === null && localStorage.getItem('game-toggle') !== null) {
    localStorage.setItem('tracker-toggle', localStorage.getItem('game-toggle'));
  }

  const saved = ['toggle-pa', 'toggle-ci', 'toggle-ch', 'toggle-x', 'audio-toggle', 'magnify-toggle', 'tracker-toggle'];
  saved.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const value = localStorage.getItem(id);
    if (value !== null) el.checked = value === 'true';
    el.addEventListener('change', () => localStorage.setItem(id, el.checked));
  });
});
