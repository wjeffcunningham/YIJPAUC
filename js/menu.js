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

  // --- 3, 4 retired 2026-10-30 ---
  // Checkbox persistence lives in the inline script in index.html (it also
  // covers tracker-toggle). Link/room scoring moved to map.js, which records
  // only while the radar is on and no longer delays link clicks.
});
