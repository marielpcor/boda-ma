// ===== Búsqueda de canciones (Apple / Spotify / YouTube) =====
const https = require('https');

// GET JSON con reintento "inseguro" para tolerar proxies corporativos (solo metadata pública).
function httpsJson(method, urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const attempt = (insecure) => {
      const u = new URL(urlStr);
      const opts = {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: Object.assign({}, headers),
        timeout: 9000,
      };
      if (insecure) opts.rejectUnauthorized = false;
      if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);

      const req = https.request(opts, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); }
          } else {
            reject(new Error('HTTP ' + res.statusCode + ': ' + d.slice(0, 200)));
          }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', (e) => {
        const cert = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/i.test((e.code || '') + (e.message || ''));
        if (!insecure && cert) attempt(true);
        else reject(e);
      });
      if (body) req.write(body);
      req.end();
    };
    attempt(false);
  });
}

// ---------- Qué fuentes están disponibles ----------
function sources() {
  return {
    apple: true,
    spotify: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    youtube: Boolean(process.env.YOUTUBE_API_KEY),
  };
}

// ---------- Apple / iTunes (gratis, sin clave) ----------
async function searchApple(q) {
  const url = 'https://itunes.apple.com/search?media=music&entity=song&limit=10&term=' + encodeURIComponent(q);
  const data = await httpsJson('GET', url, { Accept: 'application/json' });
  return (data.results || [])
    .filter((r) => r.trackViewUrl && r.trackName)
    .map((r) => ({
      title: r.trackName,
      artist: r.artistName || '',
      art: (r.artworkUrl100 || '').replace('100x100', '120x120'),
      url: r.trackViewUrl,
      platform: 'Apple Music',
    }));
}

// ---------- Spotify (requiere client id + secret) ----------
let spToken = null;
let spTokenExp = 0;
async function spotifyToken() {
  if (spToken && Date.now() < spTokenExp) return spToken;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const basic = Buffer.from(id + ':' + secret).toString('base64');
  const body = 'grant_type=client_credentials';
  const data = await httpsJson('POST', 'https://accounts.spotify.com/api/token', {
    Authorization: 'Basic ' + basic,
    'Content-Type': 'application/x-www-form-urlencoded',
  }, body);
  spToken = data.access_token;
  spTokenExp = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
  return spToken;
}
async function searchSpotify(q) {
  const token = await spotifyToken();
  const url = 'https://api.spotify.com/v1/search?type=track&limit=10&q=' + encodeURIComponent(q);
  const data = await httpsJson('GET', url, { Authorization: 'Bearer ' + token });
  const items = (data.tracks && data.tracks.items) || [];
  return items.map((t) => ({
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    art: (t.album && t.album.images && t.album.images.length ? t.album.images[t.album.images.length - 1].url : ''),
    url: t.external_urls && t.external_urls.spotify,
    platform: 'Spotify',
  })).filter((x) => x.url);
}

// ---------- YouTube (requiere API key) ----------
async function searchYouTube(q) {
  const key = process.env.YOUTUBE_API_KEY;
  const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=10&q='
    + encodeURIComponent(q) + '&key=' + key;
  const data = await httpsJson('GET', url, { Accept: 'application/json' });
  return (data.items || [])
    .filter((it) => it.id && it.id.videoId)
    .map((it) => ({
      title: it.snippet.title,
      artist: it.snippet.channelTitle || '',
      art: it.snippet.thumbnails && it.snippet.thumbnails.default ? it.snippet.thumbnails.default.url : '',
      url: 'https://www.youtube.com/watch?v=' + it.id.videoId,
      platform: 'YouTube',
    }));
}

async function search(source, q) {
  const enabled = sources();
  if (source === 'apple') return searchApple(q);
  if (source === 'spotify') {
    if (!enabled.spotify) { const e = new Error('Spotify no está configurado.'); e.notConfigured = true; throw e; }
    return searchSpotify(q);
  }
  if (source === 'youtube') {
    if (!enabled.youtube) { const e = new Error('YouTube no está configurado.'); e.notConfigured = true; throw e; }
    return searchYouTube(q);
  }
  const e = new Error('Fuente desconocida.');
  e.badSource = true;
  throw e;
}

module.exports = { sources, search };
