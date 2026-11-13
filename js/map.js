// Radar, document map, sound cues, bookmark and survey.
//
// Rooms are <details data-expand-id> sections; opening one while the radar
// (#tracker-toggle) is on records it in localStorage. Dossier sections with
// no fold carry data-visit-id on their anchor and count as rooms once their
// heading has sat on screen for a moment. .track-link clicks are
// recorded the same way. Nothing leaves the reader's browser except the
// survey readout, which is pre-filled into the Google Form when they follow
// the survey link.

(function () {
  'use strict';

  var ROOMS_KEY  = 'roomsOpened';
  var WEIGHT_KEY = 'roomWeights';   // { id: points } for rooms opened
  var LINKS_KEY  = 'visitedLinks';
  var EPI_KEY    = 'collectedEpigraphs';
  var SURVEY_KEY = 'surveyTaken';
  var UNLOCK_AT  = 5;
  var BOOK_KEY   = 'bookmark';      // { pathname: { id, label } }
  var SEEN_KEY   = 'welcomed';

  // Storage
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

  // Page
  function radarOn() {
    var t = document.getElementById('tracker-toggle');
    return !!(t && t.checked);
  }
  function rooms() {
    return Array.prototype.slice.call(
      document.querySelectorAll('details[data-expand-id]'));
  }
  function visits() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-visit-id]'));
  }
  // Main rooms score 3, nested entries and quote-toggles 1 (data-weight).
  function weightOf(el) {
    return parseInt(el.dataset.weight, 10) || 1;
  }
  function weights() {
    try { return JSON.parse(localStorage.getItem(WEIGHT_KEY)) || {}; } catch (e) { return {}; }
  }
  // Weight of an opened room, wherever it is: saved when opened, else the map's entry.
  function storedWeight(id, w) {
    if (w[id]) return w[id];
    var node = document.getElementById('mapnode-' + id);
    return node ? (parseInt(node.dataset.weight, 10) || 1) : 1;
  }
  function points() {
    var w = weights();
    return read(ROOMS_KEY).reduce(function (n, id) { return n + storedWeight(id, w); }, 0);
  }
  function mainsOpened() {
    var w = weights();
    return read(ROOMS_KEY).filter(function (id) { return storedWeight(id, w) >= 3; }).length;
  }
  function totals() {
    var nav = document.querySelector('.docmap[data-points-total]');
    return {
      points: nav ? parseInt(nav.dataset.pointsTotal, 10) : 0,
      rooms: nav ? parseInt(nav.dataset.roomsTotal, 10) : rooms().length
    };
  }
  function levelOf(el) {
    var n = 1;
    for (var p = el.parentElement; p; p = p.parentElement) {
      if (p.matches && p.matches('details[data-expand-id]')) n++;
    }
    return n;
  }

  // Cues
  // Note names → Hz (equal temperament, A4 = 440)
  function hz(n) {
    var m = /^([A-G])(#?)(\d)$/.exec(n);
    var semi = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] +
      (m[2] ? 1 : 0) + (parseInt(m[3], 10) - 4) * 12;
    return 440 * Math.pow(2, semi / 12);
  }
  // [note, start (s), length (s), level (0–1, default 1)]
  // Deeper rooms sit a step lower.
  var CUES = {
    room: [
      [['A3', 0, 0.7], ['E4', 0.09, 0.6, 0.3]],
      [['G3', 0, 0.7], ['D4', 0.09, 0.6, 0.3]],
      [['F3', 0, 0.7], ['C4', 0.09, 0.6, 0.3]],
      [['E3', 0, 0.7], ['B3', 0.09, 0.6, 0.3]]
    ],
    epigram:  [['D4', 0, 0.8], ['A4', 0.1, 0.7, 0.3]],
    // first epigram: the same figure, held longer, with an octave on top
    epigramFirst: [['D4', 0, 1.1, 1.15], ['A4', 0.1, 1.0, 0.4], ['D5', 0.24, 0.9, 0.22]],
    unlock:   [['A3', 0, 1.1], ['E4', 0, 1.1, 0.35], ['A4', 0.16, 1.0, 0.22]],
    complete: [['D3', 0, 1.6], ['A3', 0, 1.6, 0.45],
               ['D4', 0.2, 1.4, 0.28], ['F4', 0.2, 1.4, 0.16]]
  };

  var ctx = null, bus = null;
  function soundOn() {
    try { return localStorage.getItem('radar-mute') !== 'true'; } catch (e) { return true; }
  }
  function audio() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // low-pass filter plus a faint echo
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
      var seq = name === 'room'
        ? CUES.room[Math.min(level || 1, CUES.room.length) - 1]
        : CUES[name];
      if (!seq) return;
      var play = function () {
        var now = ctx.currentTime + 0.02;
        seq.forEach(function (n) { voice(hz(n[0]), now + n[1], n[2], n[3]); });
      };
      // a suspended context has a frozen clock: wait for it to start
      if (ctx.state !== 'running' && ctx.resume) ctx.resume().then(play, function () {});
      else play();
    } catch (e) {}
  }

  // Message box (reuses .unlock-toast)
  function note(text) {
    var el = document.createElement('div');
    el.className = 'unlock-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }

  // Map
  function light(id) {
    var node = document.getElementById('mapnode-' + id);
    if (node) node.classList.add('lit');
  }
  // Count only epigrams still on the page.
  function epiIds() {
    return Array.prototype.map.call(
      document.querySelectorAll('details[data-collect-id]'),
      function (d) { return d.dataset.collectId; });
  }
  function epiHave() {
    var ids = epiIds();
    return read(EPI_KEY).filter(function (id) { return ids.indexOf(id) !== -1; });
  }
  // Length of each room, drawn as a short rule after its title
  // (square root of its word count, so short rooms still show).
  function drawLengths() {
    var lis = document.querySelectorAll('.docmap li[data-words]');
    var max = 0;
    Array.prototype.forEach.call(lis, function (li) {
      max = Math.max(max, parseInt(li.dataset.words, 10) || 0);
    });
    Array.prototype.forEach.call(lis, function (li) {
      if (li.querySelector(':scope > .docmap-len')) return;
      var bar = document.createElement('span');
      bar.className = 'docmap-len';
      bar.setAttribute('aria-hidden', 'true');
      bar.style.setProperty('--len', Math.sqrt((parseInt(li.dataset.words, 10) || 0) / max).toFixed(3));
      var a = li.querySelector(':scope > a');
      if (a) a.insertAdjacentElement('afterend', bar);
    });
  }
  function ledger(id, have, all) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(document.createTextNode(have));
    var s = document.createElement('span');
    s.className = 'map-ledger-of';
    s.textContent = ' / ' + all;
    el.appendChild(s);
  }
  function refreshMap() {
    var opened = read(ROOMS_KEY), t = totals();
    drawLengths();
    opened.forEach(light);
    // quote-toggles under a main room: one small square each, filled once opened
    Array.prototype.forEach.call(document.querySelectorAll('.docmap li[data-kids]'), function (li) {
      var kids = li.dataset.kids.split(' ');
      var have = kids.filter(function (id) { return opened.indexOf(id) !== -1; }).length;
      var tally = li.querySelector('.docmap-tally');
      if (tally) {
        tally.innerHTML = '';
        kids.forEach(function (id) {
          var q = document.createElement('i');
          if (opened.indexOf(id) !== -1) q.className = 'on';
          tally.appendChild(q);
        });
        tally.title = have + ' of ' + kids.length + (kids.length === 1 ? ' quote' : ' quotes') + ' opened';
      }
      li.classList.toggle('full', have === kids.length);
    });
    var nav = document.querySelector('.docmap');
    var epiAll = epiIds().length || (nav ? parseInt(nav.dataset.epigramsTotal, 10) || 0 : 0);
    var epiGot = epiIds().length ? epiHave().length : Math.min(read(EPI_KEY).length, epiAll);
    var links = read(LINKS_KEY).filter(function (id) { return String(id).indexOf('expand-') !== 0; });
    ledger('map-l-rooms', mainsOpened(), t.rooms);
    ledger('map-l-points', points(), t.points);
    ledger('map-l-epigrams', epiGot, epiAll);
    ledger('map-l-links', links.length, 101);
  }
  function checkUnlock(announce) {
    var box = document.getElementById('map-unlocked');
    if (!box || box.checked) return;
    if (mainsOpened() >= UNLOCK_AT || flag(SURVEY_KEY)) {
      box.checked = true;
      if (announce) { cue('unlock'); note('Map unlocked: 🗺️ is now in the tools menu.'); }
    }
  }
  function openTo(target) {
    for (var el = target; el; el = el.parentElement) {
      if (el.tagName === 'DETAILS') el.open = true;
    }
  }

  // Recording
  function recordRoom(el, withChime) {
    if (!radarOn()) return;
    var id = el.dataset.expandId || el.dataset.visitId;
    var opened = read(ROOMS_KEY);
    if (opened.indexOf(id) !== -1) return;
    opened.push(id);
    write(ROOMS_KEY, opened);
    var w = weights(); w[id] = weightOf(el);
    try { localStorage.setItem(WEIGHT_KEY, JSON.stringify(w)); } catch (e) {}
    light(id);
    if (withChime) cue('room', el.dataset.visitId ? 1 : levelOf(el));
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

  // Survey readout
  // Google Form field for the readout
  var READOUT_ENTRY = 'entry.1702901217';

  function readoutText() {
    var links = read(LINKS_KEY).filter(function (id) {
      return String(id).indexOf('expand-') !== 0;
    });
    var t = totals();
    return 'Points ' + points() + '/' + t.points + '; ' +
      'Rooms ' + mainsOpened() + '/' + t.rooms +
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
      return String(id).indexOf('expand-') !== 0;
    });
    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    var t = totals();
    set('readout-rooms', mainsOpened() + ' / ' + t.rooms + ' (' + points() + ' / ' + t.points + ' points)');
    set('readout-epigrams', epiHave().length + ' / ' + epiIds().length);
    set('readout-links', String(links.length));
    box.hidden = false;
  }

  // Bookmark & welcome
  // Bookmarkable places: rooms on the essay, section anchors on the dossier,
  // skipping any inside a closed fold.
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
  // Share of this page's points opened (0–1).
  var RESUME_AT = 0.2;
  function pageRead() {
    var opened = read(ROOMS_KEY), have = 0, all = 0;
    rooms().forEach(function (el) {
      var w = weightOf(el); all += w;
      if (opened.indexOf(el.dataset.expandId) !== -1) have += w;
    });
    return all ? have / all : 0;
  }
  // How far down the page the reader is (0–1).
  function depth() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, window.scrollY / max) : 0;
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
    var prev = all[location.pathname] || {};
    all[location.pathname] = { id: here.id, label: labelOf(here),
      depth: Math.max(prev.depth || 0, depth()) };
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
    var far = function () {   // dismiss after a screen of scrolling
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
        '<p class="welcome-sub">Try to find an epigram hidden in the essay: each one you open fills a page of your Epigram Book 📖</p>' +
        '<p class="welcome-sub">Progress saved automatically; additional settings in Utilities Menu ' +
        '<span class="welcome-arrow" aria-hidden="true">↗</span></p>');
      return;
    }
  }

  // Safari only lets audio start inside a tap, click or keypress handler
  // (on iPhone, touchend, not touchstart), and a fold's 'toggle' event
  // arrives a moment later, so wake the audio on the reader's touches
  // until it is running, with a silent sample to unlock it.
  var PRIME = ['pointerdown', 'touchend', 'click', 'keydown'];
  function prime() {
    if (!soundOn()) return;
    try {
      audio();
      if (ctx.state !== 'running') ctx.resume();
      var b = ctx.createBufferSource();
      b.buffer = ctx.createBuffer(1, 1, 22050);
      b.connect(ctx.destination); b.start(0);
      if (ctx.state === 'running') {
        PRIME.forEach(function (t) { document.removeEventListener(t, prime, true); });
      }
    } catch (e) {}
  }
  PRIME.forEach(function (t) { document.addEventListener(t, prime, true); });

  // Used by site.js
  window.YIJ = { cue: cue, note: note };

  // Wiring
  document.addEventListener('DOMContentLoaded', function () {

    rooms().forEach(function (el) {
      el.addEventListener('toggle', function () {
        if (el.open) recordRoom(el, true);
      });
    });

    // Visits: a section heading in the upper part of the screen for 1.2s.
    if ('IntersectionObserver' in window) {
      var anchors = visits(), timers = [];
      var heads = anchors.map(function (a) { return a.nextElementSibling || a; });
      var watch = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var i = heads.indexOf(e.target);
          if (i === -1) return;
          clearTimeout(timers[i]);
          if (e.isIntersecting) {
            timers[i] = setTimeout(function () { recordRoom(anchors[i], true); }, 1200);
          }
        });
      }, { rootMargin: '0px 0px -40% 0px' });
      heads.forEach(function (h) { watch.observe(h); });
    }

    var radar = document.getElementById('tracker-toggle');
    if (radar) {
      radar.addEventListener('change', function () {
        if (radar.checked) {
          note('Radar on: rooms you open are recorded on this device only.');
          // count rooms already open, without a chime
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
        if (!target) return;
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
        prefill(survey);
        setFlag(SURVEY_KEY);
        checkUnlock(true);
        showReadout();
      });
      if (flag(SURVEY_KEY)) showReadout();
    }

    // Arriving from the map on the other page (#d-01a, #expand-tz): open the fold and go there.
    var arrived = location.hash && document.getElementById(location.hash.slice(1));
    if (arrived && arrived.tagName === 'DETAILS') {
      openTo(arrived);
      setTimeout(function () { arrived.scrollIntoView({ block: 'start' }); }, 50);
    }

    checkUnlock(false);
    refreshMap();

    // Count rooms already open at load, once the saved radar setting is restored.
    setTimeout(function () {
      if (radarOn()) rooms().forEach(function (el) { if (el.open) recordRoom(el, false); });
    }, 0);

    // Greet after layout settles; save the place once the reader scrolls.
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
