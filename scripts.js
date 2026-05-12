
const API_BASE = 'https://crediia-backend-1.onrender.com';

/* ── TAB SWITCHING ── */
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('view-' + name).classList.add('active');
}

/* ══════════════════════════════════════════
   UNITARIO
══════════════════════════════════════════ */
let currentModel = 'lr';
let debounceTimer = null;
let pendingReq = false;

function selectModel(m, btn) {
  currentModel = m;
  document.querySelectorAll('#view-unitario .mbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const mstat = document.getElementById('res-model');
  mstat.textContent = m === 'lr' ? 'Reg. Logística' : 'Red Neuronal';
  mstat.style.color  = m === 'lr' ? '#3fb950' : '#c084fc';
  onFieldChange();
}

function getFormData() {
  const g = id => document.getElementById(id).value;
  return {
    no_of_dependents: parseInt(g('no_of_dependents')) || 0,
    education:     g('education')     === '' ? null : parseInt(g('education')),
    self_employed: g('self_employed') === '' ? null : parseInt(g('self_employed')),
    income_annum:  parseInt(g('income_annum'))  || 0,
    loan_amount:   parseInt(g('loan_amount'))   || 0,
    loan_term:     parseInt(g('loan_term'))     || 0,
    cibil_score:   parseInt(g('cibil_score'))   || 0,
    total_assets:  parseInt(g('total_assets'))  || 0,
  };
}

function isComplete(d) {
  return d.education !== null && d.self_employed !== null &&
    d.income_annum > 0 && d.loan_amount > 0 &&
    d.loan_term > 0 && d.cibil_score >= 300 && d.total_assets > 0;
}

function onFieldChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(sendPrediction, 400);
}

function setLoading() {
  document.getElementById('status-box').className = 'status-box loading';
  document.getElementById('status-icon').className = 'ti ti-loader-2 pulse';
  document.getElementById('status-lbl').textContent = 'Analizando…';
  document.getElementById('status-sub').textContent = 'Consultando el modelo';
}

function setIdle() {
  document.getElementById('status-box').className = 'status-box idle';
  document.getElementById('status-icon').className = 'ti ti-chart-dots';
  document.getElementById('status-lbl').textContent = 'Ingresa los datos';
  document.getElementById('status-sub').textContent = 'El resultado aparecerá automáticamente';
  updateGauge(0, false, true);
  document.getElementById('gauge-txt').textContent = '—';
  document.getElementById('gauge-sub').textContent = 'SIN DATOS';
  ['res-decision','res-conf','res-cibil'].forEach(id => {
    document.getElementById(id).textContent = '—';
    document.getElementById(id).style.color = 'var(--txt3)';
  });
  document.getElementById('note-txt').textContent = 'Completa los campos para obtener un análisis automático del perfil crediticio.';
}

function updateGauge(prob, approved, reset) {
  const fill = document.getElementById('gauge-fill');
  if (reset) { fill.style.strokeDashoffset = 188.5; return; }
  fill.style.strokeDashoffset = 188.5 - (prob / 100) * 188.5;
  fill.style.stroke = approved ? '#3fb950' : '#f85149';
  const gtxt = document.getElementById('gauge-txt');
  const gsub = document.getElementById('gauge-sub');
  gtxt.textContent = prob + '%';
  gtxt.setAttribute('fill', approved ? '#3fb950' : '#f85149');
  gsub.textContent = approved ? 'APROBADO' : 'RECHAZADO';
  gsub.setAttribute('fill', approved ? '#3fb950' : '#f85149');
}

function applyResult(prob, approved) {
  document.getElementById('status-box').className = 'status-box ' + (approved ? 'approved' : 'rejected');
  document.getElementById('status-icon').className = approved ? 'ti ti-circle-check' : 'ti ti-circle-x';
  document.getElementById('status-lbl').textContent = approved ? 'Crédito Aprobado' : 'Crédito Rechazado';
  document.getElementById('status-sub').textContent = approved
    ? 'El solicitante cumple los criterios'
    : 'El perfil no cumple los criterios mínimos';
  updateGauge(prob, approved, false);

  const dec = document.getElementById('res-decision');
  dec.textContent = approved ? 'APROBADO' : 'RECHAZADO';
  dec.style.color = approved ? '#3fb950' : '#f85149';

  const conf = prob > 72 || prob < 28 ? 'Alta' : prob > 58 || prob < 42 ? 'Media' : 'Baja';
  const confEl = document.getElementById('res-conf');
  confEl.textContent = conf;
  confEl.style.color = conf === 'Alta' ? '#3fb950' : conf === 'Media' ? '#e3b341' : '#f85149';

  const cibil = parseInt(document.getElementById('cibil_score').value) || 0;
  const cEl = document.getElementById('res-cibil');
  cEl.textContent = cibil;
  cEl.style.color = cibil >= 750 ? '#3fb950' : cibil >= 600 ? '#e3b341' : '#f85149';

  const notes = approved
    ? [`Perfil sólido con probabilidad del ${prob}%. El puntaje CIBIL e ingresos son los principales factores positivos.`,
       `Score de ${prob}% supera el umbral. La relación ingreso/préstamo y el historial crediticio respaldan la aprobación.`]
    : [`Probabilidad del ${prob}% por debajo del umbral. Se recomienda revisar el puntaje CIBIL y la relación deuda/activos.`,
       `El perfil presenta factores de riesgo. Un CIBIL bajo o alto ratio préstamo/activos puede estar afectando la decisión.`];
  document.getElementById('note-txt').textContent = notes[Math.floor(Math.random() * 2)];
}

async function sendPrediction() {
  const data = getFormData();
  if (!isComplete(data)) { setIdle(); return; }
  if (pendingReq) return;
  setLoading(); pendingReq = true;
  try {
    const endpoint = currentModel === 'lr'
      ? `${API_BASE}/regresion/unique`
      : `${API_BASE}/NN/unique`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error ' + res.status);
    const json = await res.json();
    const prob = Math.round((json.probability ?? json.probability_percent ?? (json.prob ?? 0.5)) * 100);
    const approved = json.prediction === 1 || json.approved === 1 || json.loan_status === 'Approved';
    applyResult(prob, approved);
  } catch(err) {
    setApiError(err.message);
  } finally {
    pendingReq = false;
  }
}

function setApiError(msg) {
  document.getElementById('status-box').className = 'status-box rejected';
  document.getElementById('status-icon').className = 'ti ti-wifi-off';
  document.getElementById('status-lbl').textContent = 'API no disponible';
  document.getElementById('status-sub').textContent = msg || 'No se pudo conectar con el servidor';
  updateGauge(0, false, true);
  document.getElementById('gauge-txt').textContent = '—';
  document.getElementById('gauge-sub').textContent = 'SIN DATOS';
  ['res-decision','res-conf','res-cibil'].forEach(id => {
    document.getElementById(id).textContent = '—';
    document.getElementById(id).style.color = 'var(--txt3)';
  });
  document.getElementById('note-txt').textContent = 'No se pudo conectar con la API. Asegúrate de que el servidor FastAPI esté corriendo en ' + API_BASE;
}

/* ══════════════════════════════════════════
   LOTES
══════════════════════════════════════════ */
let batchModel = 'lr';
let batchFile  = null;
let batchResults = [];

function selectBatchModel(m, btn) {
  batchModel = m;
  document.querySelectorAll('#view-lotes .mbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

const dz = document.getElementById('drop-zone');
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});

function onFileSelected(e) {
  const f = e.target.files[0];
  if (f) handleFile(f);
}

function handleFile(f) {
  const ext = f.name.split('.').pop().toLowerCase();
  if (!['csv','xlsx','xls'].includes(ext)) {
    alert('Solo se aceptan archivos .csv y .xlsx');
    return;
  }
  batchFile = f;
  document.getElementById('file-name').textContent = f.name;
  document.getElementById('file-size').textContent = (f.size / 1024).toFixed(1) + ' KB';
  document.getElementById('file-pill').style.display = 'flex';
  document.getElementById('process-btn').disabled = false;
  document.getElementById('results-card').style.display = 'none';
}

function removeFile() {
  batchFile = null;
  document.getElementById('file-pill').style.display = 'none';
  document.getElementById('process-btn').disabled = true;
  document.getElementById('batch-file-input').value = '';
  document.getElementById('results-card').style.display = 'none';
}

function fmt(n) { return '$' + Number(n).toLocaleString('en-US'); }

/* ── processBatch: llama /path y /evaluate en paralelo ── */
async function processBatch() {
  if (!batchFile) return;
  const btn = document.getElementById('process-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2 spin"></i> &nbsp;Procesando…';

  const progressWrap = document.getElementById('progress-wrap');
  const progressFill = document.getElementById('progress-fill');
  const progressTxt  = document.getElementById('progress-txt');
  progressWrap.classList.add('show');
  progressFill.style.width = '10%';
  progressTxt.textContent  = 'Leyendo archivo…';

  const predEndpoint = batchModel === 'lr'
    ? `${API_BASE}/regresion/path`
    : `${API_BASE}/NN/path`;

  const evalEndpoint = batchModel === 'lr'
    ? `${API_BASE}/regresion/evaluate`
    : `${API_BASE}/NN/evaluate`;

  // Dos FormData distintos — mismo archivo en memoria, dos "sobres" HTTP
  const fd1 = new FormData();
  fd1.append('file', batchFile);
  const fd2 = new FormData();
  fd2.append('file', batchFile);

  try {
    progressFill.style.width = '30%';
    progressTxt.textContent = 'Enviando archivo a los modelos…';

    const [predRes, evalRes] = await Promise.all([
      fetch(predEndpoint, { method: 'POST', body: fd1 }),
      fetch(evalEndpoint, { method: 'POST', body: fd2 })
    ]);

    if (!predRes.ok) throw new Error('Error predicciones: ' + predRes.status);

    const predictions = await predRes.json();
    const metrics     = evalRes.ok ? await evalRes.json() : null;

    progressFill.style.width = '90%';
    progressTxt.textContent = 'Renderizando resultados…';

    // Tabla de predicciones — igual que antes
    batchResults = predictions;
    renderResults(predictions);

    // Métricas — solo si el archivo tenía loan_status y el endpoint respondió bien
    if (metrics && !metrics.error) {
      updateMetricsPanel(metrics);
    }

    progressFill.style.width = '100%';
    setTimeout(() => progressWrap.classList.remove('show'), 600);

  } catch(err) {
    alert('Error al procesar: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-cpu"></i> &nbsp;Procesar lote';
  }
}

/* ── Actualiza el panel de métricas con datos reales del backend ── */
function updateMetricsPanel(m) {
  const p = batchModel; // 'lr' o 'nn'

  document.getElementById(`${p}-accuracy`).textContent  = (m.accuracy  * 100).toFixed(1) + '%';
  document.getElementById(`${p}-precision`).textContent = (m.precision * 100).toFixed(1) + '%';
  document.getElementById(`${p}-recall`).textContent    = (m.recall    * 100).toFixed(1) + '%';
  document.getElementById(`${p}-f1`).textContent        = m.f1.toFixed(2);

  const cm = m.confusion_matrix;
  document.getElementById(`${p}-tn`).textContent = cm.tn;
  document.getElementById(`${p}-fp`).textContent = cm.fp;
  document.getElementById(`${p}-fn`).textContent = cm.fn;
  document.getElementById(`${p}-tp`).textContent = cm.tp;

  // Muestra badge "Actualizado con lote"
  const badge = document.getElementById('metrics-badge');
  badge.classList.add('visible');
  setTimeout(() => badge.classList.remove('visible'), 4000);
}

function renderResults(results) {
  const tbody = document.getElementById('results-tbody');
  tbody.innerHTML = '';
  results.forEach((r, i) => {
    const prob     = Math.round((r.probability ?? 0.5) * 100);
    const approved = r.prediction === 1;
    const cClass   = r.cibil_score >= 750 ? 'cibil-hi' : r.cibil_score >= 600 ? 'cibil-mid' : 'cibil-lo';
    const pClass   = prob >= 60 ? 'hi' : prob >= 40 ? 'mid' : 'lo';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="num">${i + 1}</td>
      <td class="num">${fmt(r.income_annum)}</td>
      <td class="num">${fmt(r.loan_amount)}</td>
      <td class="${cClass}">${r.cibil_score}</td>
      <td><span class="prob-pill ${pClass}">${prob}%</span></td>
      <td><span class="badge ${approved ? 'ok' : 'no'}">${approved
        ? '<i class="ti ti-circle-check"></i> Aprobado'
        : '<i class="ti ti-circle-x"></i> Rechazado'}</span></td>
    `;
    tbody.appendChild(tr);
  });

  const approved = results.filter(r => r.prediction === 1).length;
  const avgProb  = Math.round(results.reduce((a, r) => a + (r.probability ?? 0.5) * 100, 0) / results.length);
  document.getElementById('sum-total').textContent    = results.length;
  document.getElementById('sum-approved').textContent = approved;
  document.getElementById('sum-rejected').textContent = results.length - approved;
  document.getElementById('sum-avg-prob').textContent = avgProb + '%';
  document.getElementById('results-card').style.display = 'block';
}

function exportCSV() {
  if (!batchResults.length) return;
  const headers = [
    'no_of_dependents','education','self_employed','income_annum',
    'loan_amount','loan_term','cibil_score','total_assets',
    'loan_income_ratio','loan_assets_ratio','prediction','probability'
  ];
  const rows = batchResults.map(r => [
    r.no_of_dependents ?? '', r.education        ?? '', r.self_employed    ?? '',
    r.income_annum     ?? '', r.loan_amount      ?? '', r.loan_term        ?? '',
    r.cibil_score      ?? '', r.total_assets     ?? '',
    r.loan_income_ratio != null ? r.loan_income_ratio : '',
    r.loan_assets_ratio != null ? r.loan_assets_ratio : '',
    r.prediction       ?? '', r.probability      ?? '',
  ]);
  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'predicciones_lote.csv';
  a.click();
}

/* ── Descarga de archivos de prueba (embebidos en base64) ── */
const SAMPLE_CSV  = "bm9fb2ZfZGVwZW5kZW50cyxlZHVjYXRpb24sc2VsZl9lbXBsb3llZCxpbmNvbWVfYW5udW0sbG9hbl9hbW91bnQsbG9hbl90ZXJtLGNpYmlsX3Njb3JlLGxvYW5fc3RhdHVzLHRvdGFsX2Fzc2V0cyxsb2FuX2luY29tZV9yYXRpbyxsb2FuX2Fzc2V0c19yYXRpbw0KMCwxLDAsMTQwMDAwMDAsMTgwMDAwMDAsOCw4NTAsMSw5NTAwMDAwMCwxLjI4NTcxNDI4NTcxNDI4NTgsMC4xODk0NzM2ODQyMTA1MjYzMg0KMSwxLDAsMTAwMDAwMDAsMTUwMDAwMDAsMTAsNzkwLDEsNzAwMDAwMDAsMS41LDAuMjE0Mjg1NzE0Mjg1NzE0MjcNCjIsMSwwLDg1MDAwMDAsMTcwMDAwMDAsMTIsNzMwLDEsNTIwMDAwMDAsMi4wLDAuMzI2OTIzMDc2OTIzMDc2OQ0KMywwLDEsNDUwMDAwMCwyNTAwMDAwMCwxOCw0MzAsMCwyNDAwMDAwMCw1LjU1NTU1NTU1NTU1NTU1NSwxLjA0MTY2NjY2NjY2NjY2NjcNCjQsMCwxLDMyMDAwMDAsMjIwMDAwMDAsMjAsMzkwLDAsMTcwMDAwMDAsNi44NzUsMS4yOTQxMTc2NDcwNTg4MjM2DQo1LDAsMSwyODAwMDAwLDE5MDAwMDAwLDI0LDM1MCwwLDE0MDAwMDAwLDYuNzg1NzE0Mjg1NzE0Mjg2LDEuMzU3MTQyODU3MTQyODU3Mg0KMSwxLDAsNzIwMDAwMCwyMTAwMDAwMCwxNCw2ODAsMSw0NjAwMDAwMCwyLjkxNjY2NjY2NjY2NjY2NjUsMC40NTY1MjE3MzkxMzA0MzQ3Ng0KMiwwLDEsNjAwMDAwMCwyNDAwMDAwMCwxNiw1NjAsMCwzMDAwMDAwMCw0LjAsMC44DQowLDEsMCw5MDAwMDAwLDE2MDAwMDAwLDksODEwLDEsNjAwMDAwMDAsMS43Nzc3Nzc3Nzc3Nzc3Nzc3LDAuMjY2NjY2NjY2NjY2NjY2NjYNCjMsMCwxLDQwMDAwMDAsMjcwMDAwMDAsMjIsNDEwLDAsMjIwMDAwMDAsNi43NSwxLjIyNzI3MjcyNzI3MjcyNzM=";
const SAMPLE_XLSX = "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";

function downloadSample(type) {
  if (type === 'csv') {
    const blob = new Blob([atob(SAMPLE_CSV)], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pruebas.csv';
    a.click();
  } else {
    const bytes = atob(SAMPLE_XLSX);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pruebas.xlsx';
    a.click();
  }
}