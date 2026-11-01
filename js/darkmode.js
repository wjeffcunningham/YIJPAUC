// Light/dark mode: dark between midnight and 4am, toggled by #toggleMode.

function setMode(mode) {
  document.body.classList.remove('light-mode', 'dark-mode');
  document.body.classList.add(mode);
}

function toggleMode() {
  const current = document.body.classList.contains('light-mode') ? 'light-mode' : 'dark-mode';
  setMode(current === 'light-mode' ? 'dark-mode' : 'light-mode');
}

document.addEventListener('DOMContentLoaded', () => {
  const hour = new Date().getHours();
  setMode(hour >= 0 && hour < 4 ? 'dark-mode' : 'light-mode');

  const toggleBtn = document.getElementById('toggleMode');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleMode);
});
