document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');

  try {
    const response = await fetch('data/dives.json');
    const data = await response.json();

    DiveMap.init().loadDives(data.dives);

    document.getElementById('dive-count').textContent = data.dives.length;
    document.getElementById('country-count').textContent = new Set(
      data.dives.map(d => d.location.split(',').pop().trim())
    ).size;

    setTimeout(() => {
      loading.classList.add('hidden');
      DiveMap.fitBounds();
    }, 600);
  } catch (err) {
    console.error('Failed to load dive data:', err);
    const msg = loading.querySelector('.loading-text');
    if (msg) msg.textContent = 'Failed to load dive data';
  }
});
