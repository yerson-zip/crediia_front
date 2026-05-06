
const API_BASE = 'https://crediia-backend.onrender.com';

/* ── TAB SWITCHING ─────────────────────── */
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

/* Drag & drop */
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

  try {
    progressFill.style.width = '30%';
    progressTxt.textContent = 'Enviando archivo al modelo…';

    const endpoint = batchModel === 'lr'
      ? `${API_BASE}/regresion/path`
      : `${API_BASE}/NN/path`;

    const formData = new FormData();
    formData.append('file', batchFile);

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Error del servidor: ' + res.status);
    const results = await res.json();

    progressFill.style.width = '90%';
    progressTxt.textContent = 'Renderizando resultados…';
    batchResults = results;
    renderResults(results);
    progressFill.style.width = '100%';
    setTimeout(() => progressWrap.classList.remove('show'), 600);

  } catch(err) {
    alert('Error al procesar: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-cpu"></i> &nbsp;Procesar lote';
  }
}

function renderResults(results) {
  const tbody = document.getElementById('results-tbody');
  tbody.innerHTML = '';
  results.forEach((r, i) => {
    const prob = Math.round((r.probability ?? 0.5) * 100);
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
    r.no_of_dependents ?? '',
    r.education        ?? '',
    r.self_employed    ?? '',
    r.income_annum     ?? '',
    r.loan_amount      ?? '',
    r.loan_term        ?? '',
    r.cibil_score      ?? '',
    r.total_assets     ?? '',
    r.loan_income_ratio != null ? r.loan_income_ratio : '',
    r.loan_assets_ratio != null ? r.loan_assets_ratio : '',
    r.prediction       ?? '',
    r.probability      ?? '',
  ]);
  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'predicciones_lote.csv';
  a.click();
}