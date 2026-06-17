// ===== Bitácora privada =====
const gate = document.getElementById('gate');
const gateForm = document.getElementById('gate-form');
const gateMsg = document.getElementById('gate-msg');
const gateBtn = document.getElementById('gate-btn');
const keyInput = document.getElementById('key');

const logPanel = document.getElementById('log-panel');
const logList = document.getElementById('log-list');
const logEmpty = document.getElementById('log-empty');
const logCount = document.getElementById('log-count');
const logoutBtn = document.getElementById('logout-btn');

const KEY_STORE = 'boda_ma_admin_key';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('es', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch (e) { return ''; }
}

function renderLog(log) {
  logCount.textContent = log.length;
  logEmpty.hidden = log.length > 0;
  logList.innerHTML = '';
  log.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'log-item ' + (entry.type === 'added' ? 'added' : 'favorite');
    li.innerHTML = `
      <span class="dot"></span>
      <span>
        ${escapeHtml(entry.message)}
        <span class="when">${formatDate(entry.at)}</span>
      </span>
    `;
    logList.appendChild(li);
  });
}

async function loadLog(key) {
  const res = await fetch('/api/log?key=' + encodeURIComponent(key));
  if (res.status === 401) {
    const err = new Error('unauthorized');
    err.code = 401;
    throw err;
  }
  if (!res.ok) throw new Error('error');
  const data = await res.json();
  return data.log || [];
}

function showPanel() {
  gate.hidden = true;
  logPanel.hidden = false;
}

function showGate() {
  gate.hidden = false;
  logPanel.hidden = true;
}

gateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = keyInput.value.trim();
  if (!key) return;
  gateBtn.disabled = true;
  gateMsg.textContent = 'Verificando…';
  gateMsg.className = 'form-msg';
  try {
    const log = await loadLog(key);
    sessionStorage.setItem(KEY_STORE, key);
    renderLog(log);
    showPanel();
  } catch (err) {
    if (err.code === 401) {
      gateMsg.textContent = 'Contraseña incorrecta.';
    } else {
      gateMsg.textContent = 'No se pudo conectar. Intenta de nuevo.';
    }
    gateMsg.className = 'form-msg err';
  } finally {
    gateBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(KEY_STORE);
  keyInput.value = '';
  gateMsg.textContent = '';
  showGate();
});

// Si ya se autenticó en esta sesión del navegador, recarga la bitácora.
(async () => {
  const saved = sessionStorage.getItem(KEY_STORE);
  if (!saved) return;
  try {
    const log = await loadLog(saved);
    renderLog(log);
    showPanel();
  } catch (e) {
    sessionStorage.removeItem(KEY_STORE);
  }
})();
