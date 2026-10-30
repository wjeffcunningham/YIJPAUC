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
  // Still needed by pages/dossier.html (index.html also does this inline).
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

  // --- 4. retired 2026-10-30 ---
  // Link/room scoring: index.html uses map.js (radar-gated, no link delay);
  // pages/dossier.html still uses tracklinks.js.
});
