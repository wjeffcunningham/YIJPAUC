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
 * Node IDs used in the SVG must match the data-expand-id / data-id values
 * exactly. Each SVG node group carries id="mapnode-{id}".
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
    const label   = document.getElementById('map-score-label');
    const display = document.getElementById('map-score-display');
    const count   = getVisited().length;
    const text    = `${count} / ${TOTAL_LINKS} discovered`;
    if (label)   label.textContent   = text;
    if (display) display.textContent = text;
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
    updateScoreDisplay();
  });

})();
