'use strict';
/**
 * app.js — Folio v2 Frontend Logic
 * Drives the existing index.html DOM (all IDs are defined there).
 */

const API = window.location.origin;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const uniSelect   = $('uniSelectSidebar');
const dropZone    = $('dropZone');
const fileInput   = $('fileInput');
const filePill    = $('filePill');
const pillName    = $('pillName');
const pillSize    = $('pillSize');
const pillRm      = $('pillRm');
const uploadBadge = $('uploadBadge');
const genBtn      = $('genBtn');
const genBadge    = $('genBadge');
const logStrip    = $('logStrip');
const errWrap     = $('errWrap');
const panelCount  = $('panelCount');
const panelBody   = $('panelBody');
const emptyState  = $('emptyState');
const sysVersion  = $('sysVersion');
const sysMemory   = $('sysMemory');
const toasts      = $('toasts');

// Electron window controls (visible only inside the desktop app)
const minimizeBtn = $('minimizeBtn');
const maximizeBtn = $('maximizeBtn');
const closeBtn    = $('closeBtn');

// ── State ─────────────────────────────────────────────────────────────────────
let selectedFile = null;
let isGenerating = false;
let lastGeneratedFiles = [];

// ── Electron window controls ──────────────────────────────────────────────────
if (window.folioWindow) {
  // Show window control buttons (hidden by default in browser mode)
  const controls = document.querySelector('.window-controls');
  if (controls) controls.style.display = 'flex';
  minimizeBtn?.addEventListener('click', () => window.folioWindow.minimize());
  maximizeBtn?.addEventListener('click', () => window.folioWindow.maximize());
  closeBtn?.addEventListener('click',    () => window.folioWindow.close());
}

// ── Toast notifications ───────────────────────────────────────────────────────
function toast(message, type = 'info', durationMs = 4000) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  toasts.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, durationMs);
}

// ── Log strip ─────────────────────────────────────────────────────────────────
function appendLog(message, type = 'i') {
  const now = new Date();
  const ts  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.innerHTML = `<span class="log-t">${ts}</span><span class="log-m">${escHtml(message)}</span>`;
  logStrip.appendChild(line);
  logStrip.scrollTop = logStrip.scrollHeight;
}

// ── Server health & metrics ───────────────────────────────────────────────────
async function pollServer() {
  try {
    const [healthRes, metricsRes] = await Promise.all([
      fetch(`${API}/health`,  { signal: AbortSignal.timeout(3000) }),
      fetch(`${API}/metrics`, { signal: AbortSignal.timeout(3000) }),
    ]);

    if (healthRes.ok) {
      const liveDot = document.querySelector('.live-dot');
      if (liveDot) liveDot.style.background = '#4ade80';
    }

    if (metricsRes.ok) {
      const m = await metricsRes.json();
      if (sysVersion) sysVersion.textContent = m.version || '—';
      if (sysMemory)  sysMemory.textContent  = m.memory  || '—';
    }
  } catch {}
}

// ── Load universities ─────────────────────────────────────────────────────────
async function loadUniversities() {
  try {
    const res  = await fetch(`${API}/universities`);
    const data = await res.json();
    const unis = data.universities || [];

    uniSelect.innerHTML = '<option value="">Select institution…</option>';
    unis.forEach(({ id, displayName }) => {
      const opt = document.createElement('option');
      opt.value       = id;
      opt.textContent = displayName;
      uniSelect.appendChild(opt);
    });

    if (unis.length === 1) {
      uniSelect.value = unis[0].id;
    }

    appendLog(`Registry loaded — ${unis.length} institution(s) available`);
  } catch (err) {
    uniSelect.innerHTML = '<option value="">⚠ Could not load</option>';
    appendLog(`Registry error: ${err.message}`, 'e');
  }
}

// ── File handling ─────────────────────────────────────────────────────────────
function setFile(file) {
  if (!file) return;
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    toast('Only .xlsx Excel files are accepted.', 'error');
    return;
  }

  selectedFile = file;
  pillName.textContent = file.name;
  pillSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  filePill.classList.add('show');

  uploadBadge.textContent = 'File Ready';
  uploadBadge.className   = 'badge ready';
  appendLog(`File loaded: ${file.name} (${(file.size/1024).toFixed(1)} KB)`);
  updateGenBtn();
}

function clearFile() {
  selectedFile       = null;
  fileInput.value    = '';
  filePill.classList.remove('show');
  uploadBadge.textContent = 'Awaiting upload';
  uploadBadge.className   = 'badge waiting';
  updateGenBtn();
}

function updateGenBtn() {
  const ready = uniSelect.value && selectedFile && !isGenerating;
  genBtn.disabled = !ready;
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', e => { e.preventDefault(); dropZone.classList.remove('over'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('over');
  const file = e.dataTransfer?.files[0];
  if (file) setFile(file);
});
dropZone.addEventListener('click', () => { if (!selectedFile) fileInput.click(); });
fileInput.addEventListener('change',   () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });
pillRm?.addEventListener('click',      e => { e.stopPropagation(); clearFile(); });
uniSelect.addEventListener('change',   updateGenBtn);

// ── Generate ──────────────────────────────────────────────────────────────────
genBtn.addEventListener('click', async () => {
  if (isGenerating || genBtn.disabled) return;

  isGenerating = true;
  genBtn.disabled = true;
  genBtn.classList.add('busy');
  genBadge.textContent = 'Processing…';
  genBadge.className   = 'badge waiting';
  genBadge.style.display = '';

  // Clear previous results
  clearResults();
  clearErrors();
  appendLog(`Starting generation — university: ${uniSelect.value}`);

  const form = new FormData();
  form.append('university', uniSelect.value);
  form.append('file', selectedFile);

  try {
    const res  = await fetch(`${API}/generate`, { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

    lastGeneratedFiles = data.files || [];
    renderResults(data);

    genBadge.textContent = `${data.generated} / ${data.totalRows} done`;
    genBadge.className   = data.success ? 'badge done' : 'badge error';
    appendLog(`Done — ${data.generated} document(s) generated in ${data.elapsedMs}ms`);

    if (data.warnings?.length) {
      data.warnings.forEach(w => appendLog(`⚠ ${w}`, 'w'));
      showErrors(data.warnings);
    }

    if (data.generated > 0) {
      toast(`${data.generated} document(s) ready for download`, 'success');
    }
  } catch (err) {
    genBadge.textContent = 'Failed';
    genBadge.className   = 'badge error';
    appendLog(`Error: ${err.message}`, 'e');
    toast(err.message, 'error', 6000);
  } finally {
    isGenerating = false;
    updateGenBtn();
    genBtn.classList.remove('busy');
  }
});

// ── Results panel ─────────────────────────────────────────────────────────────
function clearResults() {
  Array.from(panelBody.children).forEach(el => {
    if (el !== emptyState) el.remove();
  });
  emptyState.style.display = '';
  panelCount.textContent   = '0 of 0';
  lastGeneratedFiles       = [];
  // Remove zip button if present
  $('zipBtn')?.remove();
}

function renderResults(data) {
  const files = data.files || [];
  emptyState.style.display = files.length ? 'none' : '';
  panelCount.textContent   = `${files.length} of ${data.totalRows}`;

  files.forEach(f => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="ri-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="1" width="10" height="12" rx="1.5"/>
          <path d="M4.5 5h5M4.5 7.5h3.5M4.5 10h4"/>
        </svg>
      </div>
      <div class="ri-info">
        <div class="ri-name">${escHtml(f.applicant)}</div>
        <div class="ri-file">${escHtml(f.filename)}</div>
      </div>
      <a class="ri-dl" href="${API}${f.path}" download="${escHtml(f.filename)}" title="Download">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M6 1v7M3 6l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M1 11h10" stroke-linecap="round"/>
        </svg>
      </a>
    `;
    panelBody.appendChild(item);
  });

  // Add "Download All ZIP" button if more than 1 file
  if (files.length > 1) {
    const zipBtn = document.createElement('button');
    zipBtn.id        = 'zipBtn';
    zipBtn.className = 'zip-btn';
    zipBtn.textContent = `Download All (${files.length}) as ZIP`;
    zipBtn.addEventListener('click', downloadZip);
    panelBody.appendChild(zipBtn);
  }
}

async function downloadZip() {
  try {
    const res = await fetch(`${API}/download-all`);
    if (!res.ok) throw new Error('ZIP generation failed');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'generated_forms.zip';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Error display ─────────────────────────────────────────────────────────────
function clearErrors() {
  errWrap.innerHTML    = '';
  errWrap.style.display = 'none';
}

function showErrors(warnings) {
  if (!warnings.length) return;
  errWrap.style.display = '';
  errWrap.innerHTML = warnings.map(w =>
    `<div class="err-line">⚠ ${escHtml(w)}</div>`
  ).join('');
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────
$('btnAdmissions')?.addEventListener('click', () => {
  setActiveNav('btnAdmissions');
  $('mainPanel')?.scrollTo({ top: 0, behavior: 'smooth' });
});

$('btnArchive')?.addEventListener('click', () => {
  fetch(`${API}/open-outputs`, { method: 'POST' }).catch(() => {});
  toast('Opening outputs folder…', 'info', 2000);
});

$('btnSettings')?.addEventListener('click', () => {
  fetch(`${API}/open-templates`, { method: 'POST' }).catch(() => {});
  toast('Opening templates folder…', 'info', 2000);
});

function setActiveNav(activeId) {
  ['btnAdmissions','btnQueue','btnArchive','btnSettings'].forEach(id => {
    $(`${id}`)?.classList.toggle('active', id === activeId);
  });
}

// ── Download Excel template button in sidebar ─────────────────────────────────
uniSelect.addEventListener('change', () => {
  updateGenBtn();
  updateTemplateLink();
});

function updateTemplateLink() {
  let existingLink = $('tplLink');
  if (!uniSelect.value) {
    existingLink?.remove();
    return;
  }

  if (!existingLink) {
    existingLink = document.createElement('a');
    existingLink.id        = 'tplLink';
    existingLink.className = 'tpl-link';
    existingLink.textContent = '↓ Download Excel Template';
    // Insert after select
    uniSelect.parentElement.insertAdjacentElement('afterend', existingLink);
  }

  existingLink.href     = `${API}/excel-template/${uniSelect.value}`;
  existingLink.download = '';
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await loadUniversities();
  await pollServer();
  updateGenBtn();
  setInterval(pollServer, 8000);
})();
