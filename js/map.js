/**
 * map.js — YIJPAUC radar, rooms, chime, map and survey
 *
 * Everything here only records while the radar (#tracker-toggle) is on,
 * and only in this browser's localStorage.
 *
 *  Rooms   every <details data-expand-id="..."> is a room. The total and
 *          each room's level (how deeply it is nested in other rooms)
 *          are read from the page, so new sections count automatically.
 *  Chime   the first opening of each room plays a short soft tone,
 *          one step higher per level (C, E, G, high C). Made in the
 *          browser; no sound files.
 *  Map     the hand-written outline in #map-modal: opened rooms get .lit,
 *          the legend reads "n / N rooms", and each entry opens its
 *          section (and the folds around it) before jumping.
 *          The 🗺️ icon shows once #map-unlocked is ticked: after 5 rooms,
 *          or after the survey link in About is followed.
 *  Links   .track-link clicks are recorded (data-id) into visitedLinks.
 *          No preventDefault, no delay: links behave like links.
 *  Survey  following the survey link unlocks the map, shows the
 *          reader's readout under it, and pre-fills the same readout
 *          into the Google Form's Readout field (READOUT_ENTRY).
 *
 * Replaces the old map.js + tracklinks.js + the scoring half of menu.js,
 * which were three scripts writing to one list (links and rooms mixed,
 * out of a hard-coded 101).
 */

(function () {
  'use strict';

  var ROOMS_KEY  = 'roomsOpened';
  var LINKS_KEY  = 'visitedLinks';
  var EPI_KEY    = 'collectedEpigraphs';
  var SURVEY_KEY = 'surveyTaken';
  var UNLOCK_AT  = 5;
  var NOTES      = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6

  // ── storage ────────────────────────────────────────────────────────────
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch (e) { return []; }
  }
  function write(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
  }
  function flag(key) {
    try { return localStorage.getItem(key) === 'true'; } catch (e) { return false; }
  }
  function setFlag(key) {
    try { localStorage.setItem(key, 'true'); } catch (e) {}
  }

  // ── page ───────────────────────────────────────────────────────────────
  function radarOn() {
    var t = document.getElementById('tracker-toggle');
    return !!(t && t.checked);
  }
  function rooms() {
    return Array.prototype.slice.call(
      document.querySelectorAll('details[data-expand-id]'));
  }
  function levelOf(el) {
    var n = 1;
    for (var p = el.parentElement; p; p = p.parentElement) {
      if (p.matches && p.matches('details[data-expand-id]')) n++;
    }
    return n;
  }

  // ── chime ──────────────────────────────────────────────────────────────
  var ctx = null;
  function chime(level) {
    try { if (localStorage.getItem('radar-mute') === 'true') return; } catch (e) {}
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      var f = NOTES[Math.min(level, NOTES.length) - 1];
      var now = ctx.currentTime;
      [[f, 0.06], [f * 2, 0.015]].forEach(function (pair) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = pair[0];
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(pair[1], now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.75);
      });
    } catch (e) {}
  }

  // ── message box (reuses .unlock-toast) ─────────────────────────────────
  function note(text) {
    var el = document.createElement('div');
    el.className = 'unlock-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }

  // ── map ────────────────────────────────────────────────────────────────
  function light(id) {
    var node = document.getElementById('mapnode-' + id);
    if (node) node.classList.add('lit');
  }
  function refreshMap() {
    var opened = read(ROOMS_KEY);
    opened.forEach(light);
    var label = document.getElementById('map-score-label');
    if (label) label.textContent = opened.length + ' / ' + rooms().length + ' rooms';
  }
  function checkUnlock(announce) {
    var box = document.getElementById('map-unlocked');
    if (!box || box.checked) return;
    if (read(ROOMS_KEY).length >= UNLOCK_AT || flag(SURVEY_KEY)) {
      box.checked = true;
      if (announce) note('Map unlocked: 🗺️ is now in the tools menu.');
    }
  }
  function openTo(target) {
    for (var el = target; el; el = el.parentElement) {
      if (el.tagName === 'DETAILS') el.open = true;
    }
  }

  // ── recording ──────────────────────────────────────────────────────────
  function recordRoom(el, withChime) {
    if (!radarOn()) return;
    var id = el.dataset.expandId;
    var opened = read(ROOMS_KEY);
    if (opened.indexOf(id) !== -1) return;
    opened.push(id);
    write(ROOMS_KEY, opened);
    light(id);
    if (withChime) chime(levelOf(el));
    checkUnlock(true);
  }
  function recordLink(id) {
    if (!radarOn() || !id) return;
    var visited = read(LINKS_KEY);
    if (visited.indexOf(id) === -1) {
      visited.push(id);
      write(LINKS_KEY, visited);
    }
  }

  // ── survey readout ─────────────────────────────────────────────────────
  // Google Form "Readout (Filled-in Automatically)" field
  var READOUT_ENTRY = 'entry.1702901217';

  function readoutText() {
    var links = read(LINKS_KEY).filter(function (id) {
      return String(id).indexOf('expand-') !== 0;
    });
    return 'Rooms ' + read(ROOMS_KEY).length + '/' + rooms().length +
      ' (' + read(ROOMS_KEY).join(', ') + '); ' +
      'Epigrams ' + read(EPI_KEY).length + '/' +
      document.querySelectorAll('details[data-collect-id]').length +
      ' (' + read(EPI_KEY).join(', ') + '); ' +
      'Links ' + links.length + ' (' + links.join(', ') + ')';
  }

  function prefill(a) {
    var base = a.href.split('?')[0];
    a.href = base + '?usp=pp_url&' + READOUT_ENTRY + '=' +
      encodeURIComponent(readoutText());
  }

  function showReadout() {
    var box = document.getElementById('survey-readout');
    if (!box) return;
    var links = read(LINKS_KEY).filter(function (id) {
      return String(id).indexOf('expand-') !== 0; // old map.js mixed rooms in here
    });
    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('readout-rooms', read(ROOMS_KEY).length + ' / ' + rooms().length);
    set('readout-epigrams', read(EPI_KEY).length + ' / ' +
      document.querySelectorAll('details[data-collect-id]').length);
    set('readout-links', String(links.length));
    box.hidden = false;
  }

  // ── wiring ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {

    rooms().forEach(function (el) {
      el.addEventListener('toggle', function () {
        if (el.open) recordRoom(el, true);
      });
    });

    var radar = document.getElementById('tracker-toggle');
    if (radar) {
      radar.addEventListener('change', function () {
        if (radar.checked) {
          note('Radar on: rooms you open are recorded on this device only.');
          // rooms already open (e.g. Section 3) count, without a chime
          rooms().forEach(function (el) { if (el.open) recordRoom(el, false); });
        } else {
          note('Radar off: nothing is being recorded.');
        }
      });
    }

    document.querySelectorAll('.track-link').forEach(function (link) {
      link.addEventListener('click', function () { recordLink(link.dataset.id); });
    });

    var mapToggle = document.getElementById('map-modal-toggle');
    if (mapToggle) {
      mapToggle.addEventListener('change', function () {
        if (mapToggle.checked) refreshMap();
      });
    }
    document.querySelectorAll('.docmap a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = document.getElementById(a.getAttribute('href').slice(1));
        if (!target) return;                    // fall back to plain anchor
        e.preventDefault();
        if (mapToggle) mapToggle.checked = false;
        openTo(target);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + target.id);
      });
    });

    var survey = document.getElementById('survey-link');
    if (survey) {
      survey.addEventListener('click', function () {
        prefill(survey);   // carries the readout into the form
        setFlag(SURVEY_KEY);
        checkUnlock(true);
        showReadout();
      });
      if (flag(SURVEY_KEY)) showReadout();
    }

    checkUnlock(false);
    refreshMap();
  });
})();
