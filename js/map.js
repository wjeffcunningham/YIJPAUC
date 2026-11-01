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
 *          or not the radar is on. First visit: VVIP mark + "Why IJPAUC?"
 *          and a link to IJPAUC? (its favicon). Later visits: "Resume: …",
 *          with % of rooms opened when the radar is on.
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
  // [note, start (s), length (s), level (0–1, default 1)].
  // Low, dry and brief: an acknowledgment, not a reward. Each room is a
  // single soft tone with a faint fifth above; deeper rooms sit a step lower.
  var CUES = {
    room: [
      [['A3', 0, 0.7], ['E4', 0.09, 0.6, 0.3]],
      [['G3', 0, 0.7], ['D4', 0.09, 0.6, 0.3]],
      [['F3', 0, 0.7], ['C4', 0.09, 0.6, 0.3]],
      [['E3', 0, 0.7], ['B3', 0.09, 0.6, 0.3]]
    ],
    epigram:  [['D4', 0, 0.8], ['A4', 0.1, 0.7, 0.3]],
    unlock:   [['A3', 0, 1.1], ['E4', 0, 1.1, 0.35], ['A4', 0.16, 1.0, 0.22]],
    complete: [['D3', 0, 1.6], ['A3', 0, 1.6, 0.45],
               ['D4', 0.2, 1.4, 0.28], ['F4', 0.2, 1.4, 0.16]]
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
    tone.type = 'lowpass'; tone.frequency.value = 1600;
    var delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.23; fb.gain.value = 0.2; wet.gain.value = 0.14;
    bus = ctx.createGain(); bus.gain.value = 1;
    bus.connect(tone); tone.connect(ctx.destination);
    tone.connect(delay); delay.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(ctx.destination);
    return ctx;
  }
  function voice(freq, t0, len, level) {
    var peak = 0.07 * (level == null ? 1 : level);
    // fundamental + a trace of 2nd partial; soft onset, no vibrato
    [[1, 1], [2, 0.12]].forEach(function (p) {
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * p[0];
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak * p[1], t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(peak * p[1] * 0.3, t0 + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      osc.connect(g).connect(bus);
      osc.start(t0); osc.stop(t0 + len + 0.05);
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
      seq.forEach(function (n) { voice(hz(n[0]), now + n[1], n[2], n[3]); });
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
    var base = location.pathname.indexOf('/pages/') !== -1 ? '../' : './';
    var seen = flag(SEEN_KEY);
    if (!seen) {
      setFlag(SEEN_KEY);
      welcome('<p><img src="' + base + 'vvip.png" alt="VVIP" class="welcome-logo"> ' +
        '<i>Why IJPAUC?</i> Media Essay by WJC.</p>' +
        '<p class="welcome-sub">Progress saved automatically; additional settings in Utilities Menu ' +
        '<span class="welcome-arrow" aria-hidden="true">↗</span></p>');
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
      pct = ' · ' + Math.round(100 * read(ROOMS_KEY).length / rooms().length) + '%';
    }
    welcome('<p><img src="' + base + 'vvip.png" alt="VVIP" class="welcome-logo"> ' +
      '<a href="#' + mark.id + '" class="welcome-resume">Resume: <span></span></a>' +
      '<span class="welcome-sub">' + pct + '</span></p>', function (box, close) {
        // short: just the tag before a colon ("Ch. 13"), else the title
        var l = mark.label.split(':')[0].trim();
        box.querySelector('.welcome-resume span').textContent =
          l.length > 34 ? l.slice(0, 32).trim() + '…' : l;
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
