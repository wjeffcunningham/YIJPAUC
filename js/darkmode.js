function setMode(mode) {
  console.log("called setMode");

  document.body.classList.remove('light-mode', 'dark-mode');
  document.body.classList.add(mode);

  const menuList = document.getElementById('menu-list');
  if (menuList) {
    menuList.classList.remove('light-mode', 'dark-mode');
    menuList.classList.add(mode);
  }
}

function toggleMode() {
  console.log("called toggleMode");

  const currentMode = document.body.classList.contains('light-mode') ? 'light-mode' : 'dark-mode';
  const newMode = currentMode === 'light-mode' ? 'dark-mode' : 'light-mode';
  setMode(newMode);
}

document.addEventListener('DOMContentLoaded', () => {
  // Always check time on load
  const hour = new Date().getHours();
  const defaultMode = (hour >= 0 && hour < 4) ? 'dark-mode' : 'light-mode';
  setMode(defaultMode);

  const toggleBtn = document.getElementById('toggleMode');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleMode);
  }
});
