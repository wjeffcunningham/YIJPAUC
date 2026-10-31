document.addEventListener('DOMContentLoaded', () => {
  const totalLinks = 101;
  const storageKey = 'visitedLinks';
  const scoreElement = document.getElementById('score');
  const audioToggle = document.getElementById('audio-toggle');
  const chime = document.getElementById('score-chime');

  let visited = JSON.parse(localStorage.getItem(storageKey)) || [];

  function updateScore() {
    if (scoreElement) {
      scoreElement.textContent = `Score: ${visited.length}/${totalLinks}`;
    }
  }

  updateScore();

  document.querySelectorAll('.track-link').forEach(link => {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      const id = link.dataset.id;
      let delay = 50;

      if (!visited.includes(id)) {
        visited.push(id);
        localStorage.setItem(storageKey, JSON.stringify(visited));
        updateScore();

        // 🔔 Pulse animation
        if (scoreElement) {
          scoreElement.classList.add('pulse');
          setTimeout(() => scoreElement.classList.remove('pulse'), 500);
        }

        // 🔊 Play sound if enabled
        if (audioToggle?.checked && chime && localStorage.getItem('radar-mute') !== 'true') {
          chime.currentTime = 0;
          chime.play().catch(() => {});
          delay = 450; // let the chime be heard before leaving the page
        }
      }

      setTimeout(() => {
        window.location.href = link.href;
      }, delay);
    });
  });
});
