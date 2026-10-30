// ========== AUDIO UNLOCK ==========
window.audioReady = false;
document.addEventListener("click", () => {
  window.audioReady = true;
  sessionStorage.setItem("audioReady", "true");
});
window.audioReady = sessionStorage.getItem("audioReady") === "true";

// ========== MAIN INIT ==========
document.addEventListener("DOMContentLoaded", () => {
  // --- 1. MENU NAV TOGGLE LOGIC ---
  const menuToggle = document.getElementById("menu-btn");
  const menuLinks = document.querySelectorAll(".nav-link");

  menuLinks.forEach(link => {
    link.addEventListener("click", () => {
      menuToggle.checked = false;

      const sectionId = link.getAttribute("href").substring(1);
      const toggleId = sectionId.replace("section-", "handle-");
      const sectionToggle = document.getElementById(toggleId);
      if (sectionToggle) {
        sectionToggle.checked = true;
      }
    });
  });

  // --- 2. SYNC MAGNIFY TOGGLES ---
  const menuMagnify = document.getElementById("toggle-pa");
  const mainMagnify = document.getElementById("magnify-toggle");

  menuMagnify?.addEventListener("change", () => {
    if (mainMagnify && mainMagnify.checked !== menuMagnify.checked) {
      mainMagnify.checked = menuMagnify.checked;
    }
  });

  mainMagnify?.addEventListener("change", () => {
    if (menuMagnify && menuMagnify.checked !== mainMagnify.checked) {
      menuMagnify.checked = mainMagnify.checked;
    }
  });

  // --- 3. RESTORE CHECKBOX STATE ---
const persistIds = ['toggle-pa', 'toggle-ci', 'toggle-ch', 'toggle-x', 'audio-toggle', 'magnify-toggle'];

persistIds.forEach(id => {
  const el = document.getElementById(id);
  const saved = localStorage.getItem(id);
  if (el && saved !== null) el.checked = saved === 'true';

  if (el) {
    el.addEventListener('change', () => {
      localStorage.setItem(id, el.checked);
    });
  }
});

  // --- 4. SCORE + CHIME LOGIC ---
  const totalLinks = 101;
  const storageKey = 'visitedLinks';
  const scoreElement = document.getElementById('score');
  const musicToggle = document.getElementById('music-toggle');
  const chime = document.getElementById('score-chime');

  const visited = JSON.parse(localStorage.getItem(storageKey)) || [];
  const previousCount = parseInt(scoreElement?.textContent) || 0;
  const newCount = visited.length;

  if (scoreElement) {
    scoreElement.textContent = `${newCount}/${totalLinks}`;
  }

  if (newCount > previousCount && window.audioReady && chime) {
    scoreElement.classList.add('pulse');
    setTimeout(() => scoreElement.classList.remove('pulse'), 600);
    chime.currentTime = 0;
    chime.play().catch(() => {});
  }

  document.querySelectorAll('.track-link').forEach(link => {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      const id = link.dataset.id;

      if (!visited.includes(id)) {
        visited.push(id);
        localStorage.setItem(storageKey, JSON.stringify(visited));
      }

      setTimeout(() => {
        window.location.href = link.href;
      }, 50);
    });
  });
});
