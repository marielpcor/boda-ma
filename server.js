// ===== Música Boda M & A — servidor sin dependencias (solo Node nativo) =====
const http = require('http');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { URL } = require('url');
const { backend, usingSupabase } = require('./storage');
const musicSearch = require('./search');

const PORT = process.env.PORT || 3000;

// ⚠️ CLAVE PRIVADA para ver la bitácora. Cámbiala por la que quieras.
// (También puedes definir la variable de entorno ADMIN_KEY al subirlo a internet.)
const ADMIN_KEY = process.env.ADMIN_KEY || 'boda-ma-2026';

const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- Utilidades ----------
// Normaliza la URL para detectar duplicados aunque tengan parámetros distintos.
function normalizeUrl(raw) {
  let url;
  try { url = new URL(raw.trim()); } catch (e) { return raw.trim().toLowerCase(); }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const v = url.searchParams.get('v');
    if (v) return 'youtube:' + v;
  }
  if (host === 'youtu.be') {
    const id = url.pathname.replace(/\//g, '');
    if (id) return 'youtube:' + id;
  }
  if (host === 'open.spotify.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const trackIdx = parts.indexOf('track');
    if (trackIdx !== -1 && parts[trackIdx + 1]) return 'spotify:track:' + parts[trackIdx + 1];
    if (parts.length >= 2) return 'spotify:' + parts[parts.length - 2] + ':' + parts[parts.length - 1];
  }
  if (host === 'music.apple.com') {
    const i = url.searchParams.get('i');
    if (i) return 'applemusic:' + i;
  }
  const cleanPath = url.pathname.replace(/\/$/, '');
  return (host + cleanPath).toLowerCase();
}

function detectPlatform(raw) {
  const r = raw.toLowerCase();
  if (r.includes('youtu')) return 'YouTube';
  if (r.includes('spotify')) return 'Spotify';
  if (r.includes('music.apple')) return 'Apple Music';
  if (r.includes('soundcloud')) return 'SoundCloud';
  if (r.includes('deezer')) return 'Deezer';
  if (r.includes('tidal')) return 'Tidal';
  return 'Otro';
}

// Una petición GET que devuelve el título de oEmbed (o null).
function oembedGet(endpoint, insecure) {
  return new Promise((resolve) => {
    const opts = { timeout: 5000 };
    if (insecure) opts.rejectUnauthorized = false; // tolera proxies corporativos (solo lee metadata pública)
    const req = https.get(endpoint, opts, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body).title || null); } catch (e) { resolve(null); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// Intenta obtener el título de la canción vía oEmbed (YouTube / Spotify).
// Si falla por certificado (proxy corporativo), reintenta tolerando el cert.
async function fetchTitle(rawUrl) {
  const platform = detectPlatform(rawUrl);
  let endpoint = null;
  if (platform === 'YouTube') {
    endpoint = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(rawUrl);
  } else if (platform === 'Spotify') {
    endpoint = 'https://open.spotify.com/oembed?url=' + encodeURIComponent(rawUrl);
  }
  if (!endpoint) return null;

  let title = await oembedGet(endpoint, false);
  if (!title) title = await oembedGet(endpoint, true); // reintento tolerante al proxy
  return title;
}

// Nombre amigable cuando no hay título ni se escribió uno.
function fallbackName(rawUrl) {
  const platform = detectPlatform(rawUrl);
  if (platform !== 'Otro') return 'Canción de ' + platform;
  try { return 'Enlace · ' + new URL(rawUrl).hostname.replace(/^www\./, ''); }
  catch (e) { return 'Enlace de canción'; }
}

function isValidUrl(raw) {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) { return false; }
}

// ---------- Helpers HTTP ----------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy(); // protección
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); }
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === '/') pathname = '/index.html';

  // Evita salir de la carpeta public
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); return res.end('Prohibido');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('No encontrado');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- Lógica de canciones ----------
// Extrae uno o varios enlaces del cuerpo (uno por línea, separados por espacios o comas).
function parseUrls(body) {
  let raw = [];
  if (Array.isArray(body.urls)) raw = raw.concat(body.urls);
  if (typeof body.url === 'string') raw = raw.concat(body.url.split(/[\s,]+/));
  return raw.map((s) => String(s).trim()).filter(Boolean);
}

async function addSong(req, res) {
  const body = await readBody(req);
  const by = (body.by || '').trim();

  // Canciones del buscador llegan en "items" (con nombre conocido);
  // los enlaces pegados llegan en "url"/"urls" (sin nombre).
  let entries = [];
  if (Array.isArray(body.items)) {
    entries = body.items
      .filter((it) => it && it.url)
      .map((it) => ({ url: String(it.url).trim(), name: (it.name || '').trim() }));
  }
  entries = entries.concat(parseUrls(body).map((u) => ({ url: u, name: '' })));
  // El nombre manual solo aplica si se envió UNA sola canción sin nombre.
  if (entries.length === 1 && !entries[0].name && (body.name || '').trim()) {
    entries[0].name = (body.name || '').trim();
  }

  if (!by) return sendJson(res, 400, { error: 'Por favor escribe tu nombre.' });
  if (!entries.length) return sendJson(res, 400, { error: 'Por favor elige o pega al menos una canción.' });

  const result = { added: [], favorites: [], invalid: [] };
  const seen = new Set(); // evita contar dos veces la misma canción en un solo envío

  for (const entry of entries) {
    const url = entry.url;
    if (!isValidUrl(url)) { result.invalid.push(url); continue; }
    const key = normalizeUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);

    const now = new Date().toISOString();
    const existing = await backend.findSongByKey(key);

    if (existing) {
      // Ya está: no se duplica, suma a "favoritas".
      const updated = await backend.incrementRequests(existing);
      await backend.addLog({
        type: 'favorite', by, name: updated.name, url, at: now,
        message: `${by} también pidió "${updated.name}" — ya son ${updated.requests} pedidos. ⭐`,
      });
      result.favorites.push(updated);
    } else {
      // Nueva canción.
      let name = entry.name;
      if (!name) {
        const fetched = await fetchTitle(url);
        if (fetched) name = fetched;
      }
      if (!name) name = fallbackName(url);
      const platform = detectPlatform(url);
      const song = await backend.addSong({ name, url, key, platform, addedBy: by, addedAt: now, requests: 1 });
      await backend.addLog({ type: 'added', by, name, url, at: now, message: `${by} agregó "${name}".` });
      result.added.push(song);
    }
  }

  sendJson(res, 200, result);
}

// ---------- Router ----------
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname;

  if (req.method === 'GET' && pathname === '/api/songs') {
    // Solo la lista de canciones (la bitácora NO se expone aquí).
    try { return sendJson(res, 200, { songs: await backend.getSongs() }); }
    catch (e) { return sendJson(res, 500, { error: 'Error en el servidor.' }); }
  }
  if (req.method === 'GET' && pathname === '/api/log') {
    // Bitácora privada: requiere la clave.
    const url = new URL(req.url, 'http://x');
    const key = req.headers['x-admin-key'] || url.searchParams.get('key') || '';
    if (key !== ADMIN_KEY) {
      return sendJson(res, 401, { error: 'Clave incorrecta.' });
    }
    try { return sendJson(res, 200, { log: await backend.getLog() }); }
    catch (e) { return sendJson(res, 500, { error: 'Error en el servidor.' }); }
  }
  if (req.method === 'POST' && pathname === '/api/songs') {
    try { return await addSong(req, res); }
    catch (e) { return sendJson(res, 500, { error: 'Error en el servidor.' }); }
  }
  if (req.method === 'GET' && pathname === '/api/sources') {
    // Qué plataformas de búsqueda están disponibles.
    return sendJson(res, 200, musicSearch.sources());
  }
  if (req.method === 'GET' && pathname === '/api/search') {
    const url = new URL(req.url, 'http://x');
    const source = (url.searchParams.get('source') || 'apple').toLowerCase();
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) return sendJson(res, 200, { results: [] });
    try {
      const results = await musicSearch.search(source, q);
      return sendJson(res, 200, { results });
    } catch (e) {
      if (e.notConfigured) return sendJson(res, 503, { error: e.message, notConfigured: true });
      return sendJson(res, 502, { error: 'No se pudo buscar en este momento. Intenta de nuevo.' });
    }
  }
  if (req.method === 'GET') return serveStatic(req, res);

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Método no permitido');
});

server.listen(PORT, () => {
  console.log(`\n  🎵  Música Boda M & A`);
  console.log(`  Almacenamiento: ${usingSupabase ? 'Supabase (nube)' : 'archivos locales (data/)'}`);
  console.log(`  Servidor corriendo en: http://localhost:${PORT}\n`);
});
