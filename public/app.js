// ===== Música Boda M & A — frontend =====
const form = document.getElementById('song-form');
const msg = document.getElementById('form-msg');
const pasteMsg = document.getElementById('paste-msg');
const submitBtn = document.getElementById('submit-btn');
const byInput = document.getElementById('by');
const urlInput = document.getElementById('url');
const nameInput = document.getElementById('name');

// Buscador
const sourceTabs = document.getElementById('source-tabs');
const searchInput = document.getElementById('search-input');
const searchStatus = document.getElementById('search-status');
const resultsEl = document.getElementById('results');
const addSelectedBtn = document.getElementById('add-selected-btn');

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
  if (sp) return { kind: 'spotify', src: 'https://open.spotify.com/embed/track/' + sp + '?theme=0', height: 80 };
  try {
    const u = new URL(songUrl);
    if (u.hostname.replace(/^www\./, '') === 'music.apple.com') {
      return { kind: 'apple', src: 'https://embed.music.apple.com' + u.pathname + u.search, height: 175 };
    }
  } catch (e) { /* noop */ }
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
    let player;
    if (embed && embed.kind === 'youtube') {
      player = `<div class="preview"><div class="yt-frame"><iframe src="${escapeHtml(embed.src)}"
        title="${escapeHtml(s.name)}" loading="lazy"
        allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div></div>`;
    } else if (embed && embed.kind === 'spotify') {
      player = `<div class="preview"><iframe class="sp-frame" src="${escapeHtml(embed.src)}"
        title="${escapeHtml(s.name)}" height="${embed.height || 152}" loading="lazy"
        allow="encrypted-media"></iframe></div>`;
    } else if (embed && embed.kind === 'apple') {
      player = `<div class="preview"><iframe class="ap-frame" src="${escapeHtml(embed.src)}"
        title="${escapeHtml(s.name)}" height="${embed.height || 175}" loading="lazy"
        allow="autoplay; encrypted-media"></iframe></div>`;
    } else {
      // Plataformas sin reproductor embebido: enlace de respaldo.
      player = `<div class="preview preview--link"><a class="play" href="${escapeHtml(s.url)}"
        target="_blank" rel="noopener noreferrer">Abrir enlace ↗</a></div>`;
    }

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
      </div>
      ${player}
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

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = 'form-msg ' + (type || '');
}
function setMsg(text, type) { showMsg(msg, text, type); }

// Resume la respuesta del servidor en un mensaje legible.
function summarize(data) {
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
    parts.push(`${data.invalid.length} no válida(s) ⚠️`);
  }
  const ok = (data.added && data.added.length) || (data.favorites && data.favorites.length);
  return { text: parts.join(' · ') || 'No se procesó nada.', ok };
}

// Envía canciones (items del buscador o enlaces pegados) al servidor.
async function postSongs(payload) {
  const res = await fetch('/api/songs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// -------- Pegar enlaces (opción secundaria) --------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const by = byInput.value.trim();
  const url = urlInput.value.trim();
  const name = nameInput.value.trim();

  if (!by) return showMsg(pasteMsg, 'Por favor escribe tu nombre arriba.', 'err');
  if (!url) return showMsg(pasteMsg, 'Por favor pega al menos un enlace.', 'err');

  localStorage.setItem(SAVED_NAME, by);
  submitBtn.disabled = true;
  showMsg(pasteMsg, 'Agregando…', '');
  try {
    const { ok, data } = await postSongs({ by, url, name });
    if (!ok) { showMsg(pasteMsg, data.error || 'Ocurrió un error.', 'err'); return; }
    const s = summarize(data);
    showMsg(pasteMsg, s.text, s.ok ? 'ok' : 'err');
    if (data.added && data.added.length) urlInput.value = '';
    nameInput.value = '';
    await loadData();
  } catch (err) {
    showMsg(pasteMsg, 'No se pudo conectar con el servidor.', 'err');
  } finally {
    submitBtn.disabled = false;
  }
});

// ========== BUSCADOR ==========
const SOURCE_LABEL = { spotify: 'Spotify', apple: 'Apple Music', youtube: 'YouTube' };
const SOURCE_ICON = { spotify: '🟢', apple: '🍏', youtube: '🔴' };
const SOURCE_ORDER = ['spotify', 'apple', 'youtube'];

let currentSource = 'apple';
const selected = new Map(); // url -> { url, name }

function updateAddButton() {
  addSelectedBtn.disabled = selected.size === 0;
  addSelectedBtn.textContent = selected.size
    ? `Agregar ${selected.size} seleccionada${selected.size > 1 ? 's' : ''}`
    : 'Agregar seleccionadas';
}

async function loadSources() {
  let enabled = { apple: true };
  try {
    const res = await fetch('/api/sources');
    enabled = await res.json();
  } catch (e) { /* usa apple por defecto */ }

  const available = SOURCE_ORDER.filter((s) => enabled[s]);
  if (!available.length) available.push('apple');
  if (!available.includes(currentSource)) currentSource = available[0];

  sourceTabs.innerHTML = '';
  available.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'source-tab' + (s === currentSource ? ' active' : '');
    btn.dataset.source = s;
    btn.setAttribute('role', 'tab');
    btn.innerHTML = `${SOURCE_ICON[s]} ${SOURCE_LABEL[s]}`;
    btn.addEventListener('click', () => {
      currentSource = s;
      [...sourceTabs.children].forEach((b) => b.classList.toggle('active', b.dataset.source === s));
      if (searchInput.value.trim().length >= 2) runSearch();
      else { resultsEl.innerHTML = ''; searchStatus.textContent = ''; }
    });
    sourceTabs.appendChild(btn);
  });
}

function renderResults(results) {
  resultsEl.innerHTML = '';
  results.forEach((r) => {
    if (!r.url) return;
    const li = document.createElement('li');
    const isSel = selected.has(r.url);
    li.className = 'result' + (isSel ? ' selected' : '');
    li.dataset.url = r.url;
    li.innerHTML = `
      <img class="result__art" src="${escapeHtml(r.art || '')}" alt="" loading="lazy"
        onerror="this.style.visibility='hidden'" />
      <span class="result__info">
        <span class="result__title">${escapeHtml(r.title)}</span>
        <span class="result__artist">${escapeHtml(r.artist || '')}</span>
      </span>
      <span class="result__check">${isSel ? '✓' : '+'}</span>
    `;
    li.addEventListener('click', () => {
      if (selected.has(r.url)) selected.delete(r.url);
      else selected.set(r.url, { url: r.url, name: (r.artist ? r.title + ' — ' + r.artist : r.title) });
      li.classList.toggle('selected', selected.has(r.url));
      li.querySelector('.result__check').textContent = selected.has(r.url) ? '✓' : '+';
      updateAddButton();
    });
    resultsEl.appendChild(li);
  });
}

let searchTimer = null;
let searchSeq = 0;
function runSearch() {
  const q = searchInput.value.trim();
  if (q.length < 2) { resultsEl.innerHTML = ''; searchStatus.textContent = ''; return; }
  const seq = ++searchSeq;
  searchStatus.textContent = 'Buscando…';
  fetch(`/api/search?source=${encodeURIComponent(currentSource)}&q=${encodeURIComponent(q)}`)
    .then((res) => res.json().then((data) => ({ status: res.status, data })))
    .then(({ status, data }) => {
      if (seq !== searchSeq) return; // ignora respuestas viejas
      if (status !== 200) {
        searchStatus.textContent = data.error || 'No se pudo buscar.';
        resultsEl.innerHTML = '';
        return;
      }
      if (!data.results.length) { searchStatus.textContent = 'Sin resultados.'; resultsEl.innerHTML = ''; return; }
      searchStatus.textContent = '';
      renderResults(data.results);
    })
    .catch(() => { if (seq === searchSeq) searchStatus.textContent = 'No se pudo buscar.'; });
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 350);
});

addSelectedBtn.addEventListener('click', async () => {
  const by = byInput.value.trim();
  if (!by) return setMsg('Escribe tu nombre arriba para agregar tus canciones.', 'err');
  if (!selected.size) return;

  localStorage.setItem(SAVED_NAME, by);
  addSelectedBtn.disabled = true;
  setMsg('Agregando…', '');
  try {
    const items = [...selected.values()];
    const { ok, data } = await postSongs({ by, items });
    if (!ok) { setMsg(data.error || 'Ocurrió un error.', 'err'); return; }
    const s = summarize(data);
    setMsg(s.text, s.ok ? 'ok' : 'err');
    // Limpia la selección y los resultados
    selected.clear();
    resultsEl.innerHTML = '';
    searchInput.value = '';
    searchStatus.textContent = '';
    await loadData();
  } catch (err) {
    setMsg('No se pudo conectar con el servidor.', 'err');
  } finally {
    updateAddButton();
  }
});

loadSources();
loadData();
