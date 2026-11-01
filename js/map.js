/**
 * map.js — YIJPAUC radar, rooms, chime, map and survey
 *
 * Everything here only records while the radar (#tracker-toggle) is on,
 * and only in this browser's localStorage. The radar is on by default
 * (checked in the HTML); a reader's "off" is remembered. Used by
 * index.html and pages/dossier.html (which has links but no rooms).
 *
 *  Rooms   every <details data-expand-id="..."> is a room. The total and
 *          each room's level (how deeply it is nested in other rooms)
 *          are read from the page, so new sections count automatically.
 *  Cues    off by default (radar-mute unless set to 'false' via 🔕/🔔).
 *          Short melodic figures, made in the browser (no sound files):
 *          a soft organ-ish voice (sine + quiet overtones, gentle vibrato)
 *          through a faint echo. room = two rising notes, a step higher
 *          per level; epigram = three-note arpeggio; unlock = four-note
 *          rise; complete = small cadence. window.YIJ.cue(name) plays one.
 *  Bookmark  keeps the reader's place on each page (the last room or
 *          section heading scrolled past), on this device only, whether
 *          or not the radar is on. First visit: a welcome note. Later
 *          visits: "Welcome back — resume at …", with % of rooms opened
 *          when the radar is on.
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
  var BOOK_KEY   = 'bookmark';      // { pathname: { id, label } }
  var SEEN_KEY   = 'welcomed';

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

  // ── cues ───────────────────────────────────────────────────────────
  // Note names → Hz (equal temperament, A4 = 440)
  function hz(n) {
    var m = /^([A-G])(#?)(\d)$/.exec(n);
    var semi = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] +
      (m[2] ? 1 : 0) + (parseInt(m[3], 10) - 4) * 12;
    return 440 * Math.pow(2, semi / 12);
  }
  // [note, start (s), length (s)] — chords are notes with the same start
  var CUES = {
    room: [
      [['C5', 0, 0.5], ['G5', 0.13, 0.9]],
      [['D5', 0, 0.5], ['A5', 0.13, 0.9]],
      [['E5', 0, 0.5], ['B5', 0.13, 0.9]],
      [['G5', 0, 0.5], ['D6', 0.13, 0.9]]
    ],
    epigram:  [['E5', 0, 0.4], ['G5', 0.12, 0.4], ['C6', 0.24, 1.1]],
    unlock:   [['C5', 0, 0.35], ['E5', 0.12, 0.35], ['G5', 0.24, 0.35], ['C6', 0.36, 1.2]],
    complete: [['G4', 0, 0.4], ['C5', 0.15, 0.4], ['E5', 0.3, 0.4],
               ['D5', 0.48, 0.5], ['C5', 0.7, 1.6], ['E5', 0.7, 1.6], ['G5', 0.7, 1.6]]
  };

  var ctx = null, bus = null;
  function soundOn() {
    try { return localStorage.getItem('radar-mute') === 'false'; } catch (e) { return false; }
  }
  function audio() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // master → soft low-pass → out, plus one faint echo (KQ-style room)
    var tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 3200;
    var delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.21; fb.gain.value = 0.28; wet.gain.value = 0.22;
    bus = ctx.createGain(); bus.gain.value = 1;
    bus.connect(tone); tone.connect(ctx.destination);
    tone.connect(delay); delay.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(ctx.destination);
    return ctx;
  }
  function voice(freq, t0, len) {
    var peak = 0.05;
    // fundamental + quiet 2nd and 3rd partials: flute/organ, not beep
    [[1, 1], [2, 0.22], [3, 0.08]].forEach(function (p) {
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * p[0];
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak * p[1], t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(peak * p[1] * 0.45, t0 + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      osc.connect(g).connect(bus);
      osc.start(t0); osc.stop(t0 + len + 0.05);
      if (p[0] === 1) {            // slow, slight vibrato on the fundamental
        var lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = 5.2; depth.gain.value = freq * 0.003;
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(t0 + 0.12); lfo.stop(t0 + len + 0.05);
      }
    });
  }
  function cue(name, level) {
    if (!soundOn()) return;
    try {
      audio();
      if (ctx.state === 'suspended') ctx.resume();
      var seq = name === 'room'
        ? CUES.room[Math.min(level || 1, CUES.room.length) - 1]
        : CUES[name];
      if (!seq) return;
      var now = ctx.currentTime + 0.02;
      seq.forEach(function (n) { voice(hz(n[0]), now + n[1], n[2]); });
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
  // Epigrams counted against the folds on the page, so ids saved before
  // an epigram was removed don't inflate the count.
  function epiIds() {
    return Array.prototype.map.call(
      document.querySelectorAll('details[data-collect-id]'),
      function (d) { return d.dataset.collectId; });
  }
  function epiHave() {
    var ids = epiIds();
    return read(EPI_KEY).filter(function (id) { return ids.indexOf(id) !== -1; });
  }
  function refreshMap() {
    var opened = read(ROOMS_KEY);
    opened.forEach(light);
    var label = document.getElementById('map-score-label');
    if (label) label.textContent = opened.length + ' / ' + rooms().length + ' rooms';
    var epi = document.getElementById('map-epi-label');
    if (epi && epiIds().length) epi.textContent = epiHave().length + ' / ' + epiIds().length + ' epigrams';
  }
  function checkUnlock(announce) {
    var box = document.getElementById('map-unlocked');
    if (!box || box.checked) return;
    if (read(ROOMS_KEY).length >= UNLOCK_AT || flag(SURVEY_KEY)) {
      box.checked = true;
      if (announce) { cue('unlock'); note('Map unlocked: 🗺️ is now in the tools menu.'); }
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
    if (withChime) cue('room', levelOf(el));
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
      'Epigrams ' + epiHave().length + '/' + epiIds().length +
      ' (' + epiHave().join(', ') + '); ' +
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
    set('readout-epigrams', epiHave().length + ' / ' + epiIds().length);
    set('readout-links', String(links.length));
    box.hidden = false;
  }

  // ── bookmark & welcome ─────────────────────────────────────────────────
  // Places worth returning to: rooms on the essay page, section anchors
  // on the dossier. Only ones actually rendered (not inside a closed fold).
  function places() {
    return Array.prototype.filter.call(
      document.querySelectorAll('details[data-expand-id], a[id^="section-"]'),
      function (el) { return el.getClientRects().length > 0; });
  }
  function labelOf(el) {
    var src = el;
    if (el.tagName === 'DETAILS') {
      src = el.querySelector('summary').cloneNode(true);
      Array.prototype.forEach.call(src.querySelectorAll('.hint-text'),
        function (h) { h.remove(); });
    } else if (el.nextElementSibling && /^H\d$/.test(el.nextElementSibling.tagName)) {
      src = el.nextElementSibling;
    }
    var t = (src.textContent || '').replace(/\s+/g, ' ').trim();
    return t.length > 64 ? t.slice(0, 62).trim() + '…' : t;
  }
  function bookmarks() {
    try { return JSON.parse(localStorage.getItem(BOOK_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveBookmark() {
    var line = window.innerHeight / 3, here = null;
    places().forEach(function (el) {
      if (el.getBoundingClientRect().top < line) here = el;
    });
    if (!here || !here.id) return;
    var all = bookmarks();
    all[location.pathname] = { id: here.id, label: labelOf(here) };
    try { localStorage.setItem(BOOK_KEY, JSON.stringify(all)); } catch (e) {}
  }

  function welcome(html, onShow) {
    var box = document.createElement('div');
    box.id = 'welcome-message';
    box.setAttribute('role', 'status');
    box.innerHTML = '<button type="button" class="welcome-close" aria-label="Close">×</button>' + html;
    document.body.appendChild(box);
    var close = function () {
      box.classList.remove('show');
      setTimeout(function () { box.remove(); }, 500);
      window.removeEventListener('scroll', far);
    };
    var y0 = window.scrollY;
    var far = function () {   // reading on past a screen: let it go
      if (Math.abs(window.scrollY - y0) > window.innerHeight) close();
    };
    box.querySelector('.welcome-close').addEventListener('click', close);
    window.addEventListener('scroll', far, { passive: true });
    if (onShow) onShow(box, close);
    setTimeout(function () { box.classList.add('show'); }, 700);
  }

  function greet() {
    var seen = flag(SEEN_KEY);
    if (!seen) {
      setFlag(SEEN_KEY);
      welcome('<p><b>Welcome.</b> The folds open into rooms, and rooms within rooms. ' +
        'This page keeps your place for next time, on this device only. ' +
        '📡 notes which rooms you’ve entered; tap it to stop.</p>');
      return;
    }
    if (location.hash) return;                       // came for a particular spot
    var mark = bookmarks()[location.pathname];
    var target = mark && document.getElementById(mark.id);
    if (!target) return;
    var r = target.getBoundingClientRect();          // already there (scroll restored)
    if (target.getClientRects().length && r.top > -60 && r.top < window.innerHeight) return;
    var pct = '';
    if (radarOn() && rooms().length) {
      pct = ' · ' + Math.round(100 * read(ROOMS_KEY).length / rooms().length) + '% explored';
    }
    welcome('<p><b>Welcome back.</b> <a href="#' + mark.id + '" class="welcome-resume">Resume at ' +
      '<i></i></a>' + pct + '</p>', function (box, close) {
        box.querySelector('.welcome-resume i').textContent = mark.label;
        box.querySelector('.welcome-resume').addEventListener('click', function (e) {
          e.preventDefault();
          close();
          openTo(target);
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
  }

  // Public: cues and notes for the page's own scripts (epigram collection)
  window.YIJ = { cue: cue, note: note };

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
          note('Radar off: rooms aren’t recorded. Your bookmark is still kept.');
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

    // Radar on at load (the default): rooms already open, e.g. Section 3,
    // count without a chime. Deferred so the saved on/off state, restored
    // by the page's own DOMContentLoaded script, is applied first.
    setTimeout(function () {
      if (radarOn()) rooms().forEach(function (el) { if (el.open) recordRoom(el, false); });
    }, 0);

    // Bookmark: greet once layout (and any restored scroll) has settled,
    // then keep the place as the reader scrolls (only after they move).
    setTimeout(greet, 400);
    var pending = null, moved = false;
    window.addEventListener('scroll', function () {
      moved = true;
      if (pending) return;
      pending = setTimeout(function () { pending = null; saveBookmark(); }, 600);
    }, { passive: true });
    window.addEventListener('pagehide', function () { if (moved) saveBookmark(); });
  });
})();
