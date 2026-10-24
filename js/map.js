/**
 * map.js — yIJPAUC document map system
 *
 * Responsibilities:
 *  1. Listen for <details data-expand-id="..."> toggle (open only)
 *     → write ID to visitedLinks in localStorage
 *     → award +5 points, play chime, pulse score
 *     → illuminate corresponding map node
 *
 *  2. On map modal open → read visitedLinks → light all matching nodes
 *
 *  3. On any track-link click (link scoring already handled by menu.js /
 *     tracklinks.js) → also illuminate its map node if one exists
 *
 * The map is a plain outline in index.html (.docmap). Each entry is
 * <li id="mapnode-{id}">, matching <details id="{id}" data-expand-id="{id}">.
 *
 *  4. Clicking a map entry closes the modal, opens that section and every
 *     fold around it, and scrolls to it.
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────

  const STORAGE_KEY   = 'visitedLinks';
  const POINTS_PER_ID = 5;          // each unique ID is worth 5 pts
  const TOTAL_LINKS   = 101;        // keep in sync with menu.js

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getVisited() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function saveVisited(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function playChime() {
    const chime = document.getElementById('score-chime');
    const audioReady = window.audioReady ||
                       sessionStorage.getItem('audioReady') === 'true';
    if (chime && audioReady) {
      chime.currentTime = 0;
      chime.play().catch(() => {});
    }
  }

  function pulseScore() {
    const el = document.getElementById('score');
    if (!el) return;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 600);
  }

  function updateScoreDisplay() {
    const el = document.getElementById('score');
    if (!el) return;
    const count = getVisited().length;
    el.textContent = `${count}/${TOTAL_LINKS}`;
  }

  // ── Node illumination ──────────────────────────────────────────────────────

  function illuminateNode(id) {
    const node = document.getElementById(`mapnode-${id}`);
    if (node) node.classList.add('lit');
  }

  function illuminateAllVisited() {
    getVisited().forEach(illuminateNode);
    // sections open right now count too (e.g. Section 3, open by default)
    document.querySelectorAll('details[data-expand-id][open]')
      .forEach(el => illuminateNode(el.dataset.expandId));
  }

  // ── Record an interaction ──────────────────────────────────────────────────

  function recordId(id) {
    const visited = getVisited();
    if (visited.includes(id)) return false;   // already recorded
    visited.push(id);
    saveVisited(visited);
    updateScoreDisplay();
    pulseScore();
    playChime();
    illuminateNode(id);
    return true;
  }

  // ── <details> expand listeners ────────────────────────────────────────────

  function bindExpandListeners() {
    document.querySelectorAll('details[data-expand-id]').forEach(el => {
      el.addEventListener('toggle', function () {
        if (!this.open) return;           // ignore close events
        recordId(this.dataset.expandId);
      });
    });
  }

  // ── track-link illumination (scoring already handled by menu.js) ──────────
  // We just need to light the map node; no double-scoring.

  function bindTrackLinkMap() {
    document.querySelectorAll('.track-link').forEach(link => {
      link.addEventListener('click', function () {
        const id = this.dataset.id;
        if (id) illuminateNode(id);       // illuminate only; score via menu.js
      });
    });
  }

  // ── Map modal open ─────────────────────────────────────────────────────────

  function updateMapScoreLabel() {
    const label = document.getElementById('map-score-label');
    if (!label) return;
    const entries = document.querySelectorAll('.docmap li[id^="mapnode-"]');
    const lit     = document.querySelectorAll('.docmap li.lit');
    label.textContent = `${lit.length} / ${entries.length} sections opened`;
  }

  // ── Map entry click → open the section (and its parents), then jump ───────

  function bindDocmapLinks() {
    document.querySelectorAll('.docmap a[href^="#"]').forEach(link => {
      link.addEventListener('click', function (e) {
        const target = document.getElementById(this.getAttribute('href').slice(1));
        if (!target) return;                 // fall back to plain anchor
        e.preventDefault();
        const toggle = document.getElementById('map-modal-toggle');
        if (toggle) toggle.checked = false;  // close the map
        for (let el = target; el; el = el.parentElement) {
          if (el.tagName === 'DETAILS') el.open = true;  // fires toggle → recordId
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + target.id);
      });
    });
  }

  function bindMapModalOpen() {
    const toggle = document.getElementById('map-modal-toggle');
    if (!toggle) return;
    toggle.addEventListener('change', function () {
      if (this.checked) {
        illuminateAllVisited();
        updateMapScoreLabel();
      }
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    bindExpandListeners();
    bindTrackLinkMap();
    bindMapModalOpen();
    bindDocmapLinks();
    updateScoreDisplay();
  });

})();
