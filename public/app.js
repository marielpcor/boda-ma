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

// Recuerda el nombre de quien usa el sitio (sin login).
// Se conserva aunque refresque la página; solo se borra si limpia la caché.
const SAVED_NAME = 'boda_ma_nombre';
byInput.value = localStorage.getItem(SAVED_NAME) || '';
byInput.addEventListener('input', () => {
  localStorage.setItem(SAVED_NAME, byInput.value.trim());
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Extrae el ID de YouTube de cualquier forma de enlace.
function youtubeId(u) {
  try {
    const url = new URL(u);
    const h = url.hostname.replace(/^www\./, '');
    if (h === 'youtu.be') return url.pathname.slice(1).split('/')[0];
    if (h.includes('youtube.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'embed') return parts[1];
    }
  } catch (e) { /* noop */ }
  return null;
}

// Extrae el ID de pista de Spotify.
function spotifyTrackId(u) {
  try {
    const url = new URL(u);
    if (!url.hostname.includes('open.spotify.com')) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const i = parts.indexOf('track');
    if (i !== -1 && parts[i + 1]) return parts[i + 1].split('?')[0];
  } catch (e) { /* noop */ }
  return null;
}

// Devuelve datos para el reproductor embebido, o null si no se puede previsualizar.
function getEmbed(songUrl) {
  const yt = youtubeId(songUrl);
  if (yt) return { kind: 'youtube', src: 'https://www.youtube.com/embed/' + yt };
  const sp = spotifyTrackId(songUrl);
  if (sp) return { kind: 'spotify', src: 'https://open.spotify.com/embed/track/' + sp, height: 152 };
  return null;
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

  // Las más pedidas (favoritas) primero; a igualdad, las más antiguas arriba.
  const ordered = songs.slice().sort((a, b) => {
    const ra = a.requests || 1;
    const rb = b.requests || 1;
    if (rb !== ra) return rb - ra;
    return new Date(a.addedAt) - new Date(b.addedAt);
  });

  ordered.forEach((s, i) => {
    const reqs = s.requests || 1;
    const isFav = reqs >= 2;
    const favTag = isFav ? '<span class="fav-tag">⭐ Favorita</span>' : '';
    const votes = isFav ? `<span class="votes" title="${reqs} personas la pidieron">❤️ ${reqs}</span>` : '';

    const embed = getEmbed(s.url);
    const previewBtn = embed
      ? `<button type="button" class="preview-btn" aria-expanded="false">▶ Vista previa</button>`
      : '';
    const previewBox = embed
      ? `<div class="preview" hidden data-src="${escapeHtml(embed.src)}" data-kind="${embed.kind}" data-h="${embed.height || 0}"></div>`
      : '';

    const li = document.createElement('li');
    li.className = 'song-item' + (isFav ? ' is-fav' : '');
    li.innerHTML = `
      <div class="song-row">
        <span class="num">${i + 1}</span>
        <span class="info">
          <span class="title" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}${favTag}</span>
          <span class="meta"><span class="badge">${escapeHtml(s.platform)}</span>Agregada por ${escapeHtml(s.addedBy)}</span>
        </span>
        ${votes}
        <span class="actions">
          ${previewBtn}
          <a class="play" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">Escuchar ↗</a>
        </span>
      </div>
      ${previewBox}
    `;
    songList.appendChild(li);
  });
}

// Mostrar / ocultar la vista previa (el iframe se crea solo al abrir).
songList.addEventListener('click', (e) => {
  const btn = e.target.closest('.preview-btn');
  if (!btn) return;
  const item = btn.closest('.song-item');
  const box = item && item.querySelector('.preview');
  if (!box) return;

  const isOpen = !box.hidden;
  if (isOpen) {
    box.hidden = true;
    box.innerHTML = ''; // libera el reproductor
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '▶ Vista previa';
    return;
  }

  const src = box.dataset.src;
  if (box.dataset.kind === 'youtube') {
    box.innerHTML =
      `<div class="yt-frame"><iframe src="${src}" title="Vista previa"
        allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`;
  } else {
    const h = box.dataset.h && box.dataset.h !== '0' ? box.dataset.h : 152;
    box.innerHTML =
      `<iframe class="sp-frame" src="${src}" title="Vista previa" height="${h}"
        allow="encrypted-media" loading="lazy"></iframe>`;
  }
  box.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  btn.textContent = '✕ Ocultar';
});

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
  if (!url) return setMsg('Por favor pega al menos un enlace de canción.', 'err');

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

    if (!res.ok) {
      setMsg(data.error || 'Ocurrió un error.', 'err');
      return;
    }

    // Resumen del lote
    const parts = [];
    if (data.added && data.added.length) {
      parts.push(data.added.length === 1
        ? `Se agregó "${data.added[0].name}" 🎶`
        : `Se agregaron ${data.added.length} canciones 🎶`);
    }
    if (data.favorites && data.favorites.length) {
      parts.push(data.favorites.length === 1
        ? `"${data.favorites[0].name}" ya estaba — ¡sumaste a favoritas! ⭐`
        : `${data.favorites.length} ya estaban — sumaron a favoritas ⭐`);
    }
    if (data.invalid && data.invalid.length) {
      parts.push(`${data.invalid.length} enlace(s) no válido(s) ⚠️`);
    }
    const ok = (data.added && data.added.length) || (data.favorites && data.favorites.length);
    setMsg(parts.join(' · ') || 'No se procesó ningún enlace.', ok ? 'ok' : 'err');

    if (data.added && data.added.length) urlInput.value = '';
    nameInput.value = '';
    // NO borramos el nombre de la persona (byInput): se conserva.
    await loadData();
  } catch (err) {
    setMsg('No se pudo conectar con el servidor. Intenta de nuevo.', 'err');
  } finally {
    submitBtn.disabled = false;
  }
});

loadData();
