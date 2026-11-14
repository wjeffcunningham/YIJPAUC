// Page behaviour shared by index.html and pages/dossier.html:
// background audio, the hero clip fallback, the radar sound toggle,
// the epigram book and the scrolls.

document.addEventListener('DOMContentLoaded', () => {
  const readList = key => {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
  };

  // Background music and ambient sound

  const tracks = {
    1: document.getElementById('bg-music'),
    2: document.getElementById('bg-music-unlock5'),
    3: document.getElementById('bg-music-unlock10')
  };
  const ambient = document.getElementById('bg-audio');
  const ambientAlt = document.getElementById('bg-audio-unlock20');

  const getState = () => parseInt(localStorage.getItem('musicState')) || 0;
  const setState = s => localStorage.setItem('musicState', s);
  const linksFollowed = () => readList('visitedLinks').length;

  const toast = text => {
    const el = document.createElement('div');
    el.className = 'unlock-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };

  const stopMusic = () => {
    Object.values(tracks).forEach(a => {
      if (a) { a.pause(); a.currentTime = 0; a.muted = true; }
    });
  };

  const playMusic = state => {
    stopMusic();
    const a = tracks[state];
    if (a) { a.muted = false; a.play().catch(() => {}); }
  };

  // Tracks unlock at 5 and 10 links followed; 20 unlocks the alternate ambient.
  const cycleMusic = () => {
    const score = linksFollowed();
    const unlocked = readList('unlockedMusic');
    [5, 10, 20].forEach(level => {
      if (score >= level && !unlocked.includes(level)) {
        unlocked.push(level);
        localStorage.setItem('unlockedMusic', JSON.stringify(unlocked));
        toast(`🎉 New music unlocked at score ${level}!`);
      }
    });
    const available = [1];
    if (score >= 5) available.push(2);
    if (score >= 10) available.push(3);
    const i = available.indexOf(getState());
    const next = i === -1 ? available[0] : i === available.length - 1 ? 0 : available[i + 1];
    setState(next);
    if (next === 0) stopMusic(); else playMusic(next);
  };

  // A missing <source> never rejects play(), so check networkState first.
  const playAmbient = () => {
    const altUsable = ambientAlt && !ambientAlt.error &&
      ambientAlt.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE;
    const playDefault = () => {
      if (ambientAlt) { ambientAlt.pause(); ambientAlt.muted = true; }
      ambient.muted = false;
      ambient.play().catch(() => {});
    };
    if (linksFollowed() >= 20 && altUsable) {
      ambient.pause();
      ambient.muted = true;
      ambientAlt.muted = false;
      ambientAlt.play().catch(playDefault);
    } else {
      playDefault();
    }
  };

  const audioToggle = document.getElementById('audio-toggle');
  if (audioToggle && ambient) {
    audioToggle.addEventListener('change', () => {
      if (audioToggle.checked) {
        playAmbient();
      } else {
        ambient.pause();
        if (ambientAlt) ambientAlt.pause();
      }
    });
    // Browsers block sound until the first interaction.
    if (audioToggle.checked) {
      const start = () => { if (audioToggle.checked) playAmbient(); };
      document.addEventListener('pointerdown', start, { once: true });
      document.addEventListener('keydown', start, { once: true });
    }
  }

  const musicButton = document.getElementById('music-toggle');
  if (musicButton) musicButton.addEventListener('click', cycleMusic);
  if (getState()) playMusic(getState());

  // Hero clip: where autoplay is refused (iOS Low Power Mode, data saver),
  // swap in the image named by data-fallback. No timeout: a clip that is
  // merely slow to buffer (Safari) keeps its poster until it plays.

  const hero = document.getElementById('hero-media');
  if (hero && hero.tagName === 'VIDEO' && hero.dataset.fallback) {
    let swapped = false;
    const swap = () => {
      if (swapped || !hero.paused) return;
      swapped = true;
      const img = document.createElement('img');
      img.src = hero.dataset.fallback;
      img.alt = hero.dataset.fallbackAlt || '';
      img.id = 'hero-media';
      img.className = 'hero-media';
      hero.replaceWith(img);
    };
    const playing = hero.play();
    if (playing) playing.catch(swap);
    // Safari can leave a muted autoplay clip sitting paused without
    // rejecting play(). Once the clip has data and still isn't playing,
    // fall back; if no data arrives at all, fall back after 8 seconds.
    const check = () => setTimeout(swap, 600);
    if (hero.readyState >= 3) check();
    else hero.addEventListener('canplay', check, { once: true });
    setTimeout(() => { if (hero.readyState < 2) swap(); }, 8000);
  }

  // Radar sound toggle (🔔 / 🔕)

  const mute = document.getElementById('radar-mute');
  const muteLabel = document.getElementById('radar-mute-label');
  if (mute && muteLabel) {
    const sync = () => {
      muteLabel.textContent = mute.checked ? '🔕' : '🔔';
      muteLabel.title = mute.checked ? 'Radar sound off' : 'Radar sound on';
    };
    try { mute.checked = localStorage.getItem('radar-mute') === 'true'; } catch (e) {}
    sync();
    mute.addEventListener('change', () => {
      try { localStorage.setItem('radar-mute', mute.checked); } catch (e) {}
      sync();
    });
  }

  // Scrolls: three missable texts, kept once found (localStorage 'scrollsFound').
  //   enoch         every epigram collected
  //   crew          the Dossier's crew list (#d-08-q1) unfolded
  //   bibliography  50 links followed

  const SCROLLS = { enoch: 'the Book of Enoch', crew: 'the crew list', bibliography: 'the bibliography' };
  const scrollsFound = () => readList('scrollsFound');
  const syncScrolls = () => {
    const have = scrollsFound();
    document.querySelectorAll('.scroll-have').forEach(box => {
      box.checked = have.includes(box.dataset.scrollId);
    });
  };
  const findScroll = id => {
    const have = scrollsFound();
    if (have.includes(id)) return;
    have.push(id);
    try { localStorage.setItem('scrollsFound', JSON.stringify(have)); } catch (e) {}
    syncScrolls();
    if (window.YIJ) {
      window.YIJ.cue('unlock');
      window.YIJ.note(have.length === 1
        ? `Scroll found: ${SCROLLS[id]}. 📜 is now in the tools menu.`
        : `Scroll found: ${SCROLLS[id]}.`);
    }
  };

  // Epigram book: each epigram fold is collected the first time it opens.
  // Completion is counted against the folds on the page, so ids saved
  // before an epigram was removed don't count.

  const folds = [...document.querySelectorAll('details[data-collect-id]')];
  if (folds.length) {
    const collected = () => readList('collectedEpigraphs');
    const complete = () => {
      const have = collected();
      return folds.every(f => have.includes(f.dataset.collectId));
    };
    const syncBook = () => {
      const have = collected();
      document.querySelectorAll('.epi-have').forEach(box => {
        box.checked = have.includes(box.dataset.collectId);
      });
      const done = document.getElementById('epi-complete');
      if (done) done.checked = complete();
    };

    folds.forEach(fold => {
      fold.addEventListener('toggle', () => {
        const id = fold.dataset.collectId;
        const have = collected();
        if (!fold.open || have.includes(id)) return;
        have.push(id);
        localStorage.setItem('collectedEpigraphs', JSON.stringify(have));
        if (window.YIJ) {
          if (complete()) {
            window.YIJ.cue('complete');
            window.YIJ.note('Epigram book complete.');
            setTimeout(() => findScroll('enoch'), 3200);   // after the first message clears
          }
          else window.YIJ.cue(have.length === 1 ? 'epigramFirst' : 'epigram');
        }
        syncBook();
      });
    });

    // Book entries close the book and open the folds around their target.
    const bookToggle = document.getElementById('epigram-book-toggle');
    document.querySelectorAll('.epigram-book-entry a').forEach(entry => {
      entry.addEventListener('click', () => {
        if (bookToggle) bookToggle.checked = false;
        const target = document.querySelector(entry.getAttribute('href'));
        for (let el = target; el; el = el.parentElement) {
          if (el.tagName === 'DETAILS') el.open = true;
        }
      });
    });

    // Sort: essay order (as written), ↑ oldest first, ↓ newest first.
    // Ties (e.g. the Aristotle entries) keep their essay order.
    const sortBtn = document.getElementById('epi-sort');
    const bookList = document.querySelector('.epigram-book-list');
    if (sortBtn && bookList) {
      const entries = [...bookList.children];
      const MODES = ['essay', 'up', 'down'];
      const LABELS = { essay: 'in essay order', up: '↑ oldest first', down: '↓ newest first' };
      const applySort = mode => {
        const year = li => parseInt(li.dataset.year, 10) || 0;
        const order = mode === 'essay' ? entries
          : [...entries].sort((a, b) => mode === 'up' ? year(a) - year(b) : year(b) - year(a));
        order.forEach(li => bookList.appendChild(li));
        sortBtn.textContent = LABELS[mode];
        sortBtn.dataset.mode = mode;
      };
      let mode = 'essay';
      try { mode = localStorage.getItem('epigramSort') || 'essay'; } catch (e) {}
      if (!MODES.includes(mode)) mode = 'essay';
      applySort(mode);
      sortBtn.addEventListener('click', () => {
        const next = MODES[(MODES.indexOf(sortBtn.dataset.mode) + 1) % MODES.length];
        try { localStorage.setItem('epigramSort', next); } catch (e) {}
        applySort(next);
      });
    }

    syncBook();
    if (complete()) findScroll('enoch');   // completed before scrolls existed
  }

  // Crew list: found by unfolding it in the Dossier.

  const crewFold = document.getElementById('d-08-q1');
  if (crewFold) {
    crewFold.addEventListener('toggle', () => { if (crewFold.open) findScroll('crew'); });
  }

  // Bibliography: found once 50 links have been followed.

  const checkLinks = () => { if (linksFollowed() >= 50) findScroll('bibliography'); };
  checkLinks();
  window.addEventListener('pageshow', checkLinks);
  window.addEventListener('storage', e => {
    if (e.key === 'visitedLinks') checkLinks();
    if (e.key === 'scrollsFound') syncScrolls();
  });
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('a')) setTimeout(checkLinks, 50);
  });

  syncScrolls();
});
