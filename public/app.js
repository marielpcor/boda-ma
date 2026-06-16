// ===== Música Boda M & A — frontend =====
const form = document.getElementById('song-form');
const msg = document.getElementById('form-msg');
const submitBtn = document.getElementById('submit-btn');
const byInput = document.getElementById('by');
const urlInput = document.getElementById('url');
const nameInput = document.getElementById('name');

const songList = document.getElementById('song-list');
const songsEmpty = document.getElementById('songs-empty');
const songCount = document.getElementById('song-count');

// Recuerda el nombre de quien usa el sitio (sin login)
const SAVED_NAME = 'boda_ma_nombre';
byInput.value = localStorage.getItem(SAVED_NAME) || '';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch (e) {
    return '';
  }
}

function renderSongs(songs) {
  songCount.textContent = songs.length;
  songList.innerHTML = '';
  songsEmpty.hidden = songs.length > 0;

  songs.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = 'song-item';
    li.innerHTML = `
      <span class="num">${i + 1}</span>
      <span class="info">
        <span class="title" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
        <span class="meta"><span class="badge">${escapeHtml(s.platform)}</span>Agregada por ${escapeHtml(s.addedBy)}</span>
      </span>
      <a class="play" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">Escuchar ↗</a>
    `;
    songList.appendChild(li);
  });
}

async function loadData() {
  try {
    const res = await fetch('/api/songs');
    const data = await res.json();
    renderSongs(data.songs || []);
  } catch (e) {
    console.error('No se pudo cargar la lista', e);
  }
}

function setMsg(text, type) {
  msg.textContent = text;
  msg.className = 'form-msg ' + (type || '');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const by = byInput.value.trim();
  const url = urlInput.value.trim();
  const name = nameInput.value.trim();

  if (!by) return setMsg('Por favor escribe tu nombre.', 'err');
  if (!url) return setMsg('Por favor pega el enlace de la canción.', 'err');

  localStorage.setItem(SAVED_NAME, by);
  submitBtn.disabled = true;
  setMsg('Agregando…', '');

  try {
    const res = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ by, url, name }),
    });
    const data = await res.json();

    if (res.ok) {
      setMsg(`¡Listo! Se agregó "${data.song.name}" 🎶`, 'ok');
      urlInput.value = '';
      nameInput.value = '';
      await loadData();
    } else {
      setMsg(data.error || 'Ocurrió un error.', 'err');
      // Aunque sea duplicado, refrescamos para mostrar la bitácora actualizada
      await loadData();
    }
  } catch (err) {
    setMsg('No se pudo conectar con el servidor. Intenta de nuevo.', 'err');
  } finally {
    submitBtn.disabled = false;
  }
});

loadData();
