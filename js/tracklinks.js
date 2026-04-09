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

      if (!visited.includes(id)) {
        visited.push(id);
        localStorage.setItem(storageKey, JSON.stringify(visited));
        updateScore();

        // 🔔 Pulse animation
        scoreElement.classList.add('pulse');
        setTimeout(() => scoreElement.classList.remove('pulse'), 500);

        // 🔊 Play sound if enabled
        if (audioToggle?.checked && chime) {
          chime.currentTime = 0;
          chime.play();
        }
      }

      setTimeout(() => {
        window.location.href = link.href;
      }, 50);
    });
  });
});
