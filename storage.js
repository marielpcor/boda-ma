// ===== Capa de almacenamiento =====
// Usa Supabase si están definidas las variables de entorno SUPABASE_URL y
// SUPABASE_KEY (en producción). Si no, usa archivos JSON locales (en tu PC).
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

// ---------------------------------------------------------------------------
//  Backend de ARCHIVOS (local)
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const SONGS_FILE = path.join(DATA_DIR, 'songs.json');
const LOG_FILE = path.join(DATA_DIR, 'log.json');

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SONGS_FILE)) fs.writeFileSync(SONGS_FILE, '[]', 'utf8');
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '[]', 'utf8');
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return []; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

let counter = Date.now();
function nextId() { counter += 1; return counter.toString(36); }

const fileBackend = {
  async getSongs() {
    return readJson(SONGS_FILE);
  },
  async findSongByKey(key) {
    return readJson(SONGS_FILE).find((s) => s.key === key) || null;
  },
  async addSong(song) {
    const songs = readJson(SONGS_FILE);
    const full = { id: nextId(), ...song };
    songs.push(full);
    writeJson(SONGS_FILE, songs);
    return full;
  },
  async getLog() {
    return readJson(LOG_FILE);
  },
  async addLog(entry) {
    const log = readJson(LOG_FILE);
    const full = { id: nextId(), ...entry };
    log.unshift(full);
    writeJson(LOG_FILE, log);
    return full;
  },
};

// ---------------------------------------------------------------------------
//  Backend de SUPABASE (producción)
// ---------------------------------------------------------------------------
function supabaseRequest(method, pathAndQuery, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1' + pathAndQuery);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      timeout: 8000,
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(data ? JSON.parse(data) : null); }
          catch (e) { resolve(null); }
        } else {
          reject(new Error('Supabase ' + res.statusCode + ': ' + data));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Supabase timeout')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Mapeo: fila de Supabase -> forma que usa el frontend
function rowToSong(r) {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    key: r.song_key,
    platform: r.platform,
    addedBy: r.added_by,
    addedAt: r.added_at,
  };
}
function rowToLog(r) {
  return {
    id: r.id,
    type: r.kind,
    by: r.actor,
    name: r.name,
    url: r.url,
    at: r.created_at,
    message: r.message,
  };
}

const supabaseBackend = {
  async getSongs() {
    const rows = await supabaseRequest('GET', '/songs?select=*&order=added_at.asc');
    return (rows || []).map(rowToSong);
  },
  async findSongByKey(key) {
    const rows = await supabaseRequest('GET', '/songs?song_key=eq.' + encodeURIComponent(key) + '&select=*&limit=1');
    return rows && rows[0] ? rowToSong(rows[0]) : null;
  },
  async addSong(song) {
    const rows = await supabaseRequest('POST', '/songs', [{
      name: song.name,
      url: song.url,
      song_key: song.key,
      platform: song.platform,
      added_by: song.addedBy,
      added_at: song.addedAt,
    }]);
    return rowToSong(rows[0]);
  },
  async getLog() {
    const rows = await supabaseRequest('GET', '/log?select=*&order=created_at.desc');
    return (rows || []).map(rowToLog);
  },
  async addLog(entry) {
    const rows = await supabaseRequest('POST', '/log', [{
      kind: entry.type,
      actor: entry.by,
      name: entry.name,
      url: entry.url,
      created_at: entry.at,
      message: entry.message,
    }]);
    return rowToLog(rows[0]);
  },
};

// ---------------------------------------------------------------------------
if (!USE_SUPABASE) ensureData();

const backend = USE_SUPABASE ? supabaseBackend : fileBackend;

module.exports = {
  backend,
  usingSupabase: USE_SUPABASE,
};
