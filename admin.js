/* Panel de reservas — MOVE® Recovery Room */

const STORE_KEY = 'move_admin_key';
const $ = (id) => document.getElementById(id);

let KEY = '';
let ALL = [];
let sortBy = 'date';
let sortDir = 'asc';
let pending = null; // reserva a cancelar

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

function fechaCorta(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS[dt.getUTCDay()]} ${d} ${MESES[m - 1]} ${y}`;
}

/* ------------------------------------------------------------------ */
/* Login                                                              */
/* ------------------------------------------------------------------ */

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('loginMsg');
  msg.textContent = 'Verificando…';
  msg.className = 'form-msg';
  const ok = await tryKey($('keyInput').value.trim());
  if (!ok) {
    msg.textContent = 'Clave incorrecta.';
    msg.className = 'form-msg err';
  }
});

$('logoutBtn').addEventListener('click', () => {
  try { localStorage.removeItem(STORE_KEY); } catch {}
  KEY = '';
  ALL = [];
  $('panelView').classList.add('hidden');
  $('loginView').classList.remove('hidden');
  $('keyInput').value = '';
  $('loginMsg').textContent = '';
});

async function tryKey(key) {
  if (!key) return false;
  try {
    const res = await fetch(`/api/bookings?key=${encodeURIComponent(key)}`);
    if (!res.ok) return false;
    ALL = await res.json();
    KEY = key;
    try { localStorage.setItem(STORE_KEY, key); } catch {}
    $('loginView').classList.add('hidden');
    $('panelView').classList.remove('hidden');
    buildServiceFilter();
    render();
    return true;
  } catch {
    return false;
  }
}

async function reload() {
  const btn = $('reloadBtn');
  const label = btn.textContent;
  btn.textContent = '…';
  btn.disabled = true;
  try {
    const res = await fetch(`/api/bookings?key=${encodeURIComponent(KEY)}`);
    if (res.ok) { ALL = await res.json(); buildServiceFilter(); render(); }
  } finally {
    btn.textContent = label;
    btn.disabled = false;
  }
}
$('reloadBtn').addEventListener('click', reload);

/* ------------------------------------------------------------------ */
/* Filtros                                                            */
/* ------------------------------------------------------------------ */

['q', 'range', 'svc', 'day'].forEach((id) => {
  $(id).addEventListener('input', render);
  $(id).addEventListener('change', render);
});

$('clearBtn').addEventListener('click', () => {
  $('q').value = '';
  $('range').value = 'upcoming';
  $('svc').value = '';
  $('day').value = '';
  render();
});

document.querySelectorAll('th.sortable').forEach((th) => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (sortBy === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortBy = col; sortDir = 'asc'; }
    render();
  });
});

function buildServiceFilter() {
  const sel = $('svc');
  const current = sel.value;
  const servicios = [...new Set(ALL.map((b) => b.service))].sort();
  sel.innerHTML = '<option value="">Todos</option>' + servicios.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  sel.value = servicios.includes(current) ? current : '';
}

function filtrar() {
  const q = $('q').value.trim().toLowerCase();
  const range = $('range').value;
  const svc = $('svc').value;
  const day = $('day').value;
  const hoy = todayStr();

  let rows = ALL.filter((b) => {
    if (svc && b.service !== svc) return false;
    if (day) return b.date === day;
    if (range === 'today' && b.date !== hoy) return false;
    if (range === 'upcoming' && b.date < hoy) return false;
    if (range === 'past' && b.date >= hoy) return false;
    if (range === 'week' && (b.date < hoy || b.date > addDays(hoy, 7))) return false;
    if (q) {
      const hay = `${b.name} ${b.email} ${b.phone} ${b.notes || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const dir = sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    if (sortBy === 'date') return (`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`) * dir;
    return String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''), 'es') * dir;
  });
  return rows;
}

/* ------------------------------------------------------------------ */
/* Render                                                             */
/* ------------------------------------------------------------------ */

function render() {
  const hoy = todayStr();
  const rows = filtrar();

  // Stats (siempre sobre el total, no sobre el filtro)
  const proximas = ALL.filter((b) => b.date >= hoy);
  const deHoy = ALL.filter((b) => b.date === hoy);
  const semana = ALL.filter((b) => b.date >= hoy && b.date <= addDays(hoy, 7));
  $('stats').innerHTML = [
    ['Hoy', deHoy.length, deHoy.length ? `Primera ${deHoy.map((b) => b.time).sort()[0]} h` : 'Sin turnos'],
    ['Próximos 7 días', semana.length, `${(semana.length / 63 * 100).toFixed(0)}% de ocupación`],
    ['Próximas', proximas.length, 'Turnos por delante'],
    ['Total histórico', ALL.length, 'Reservas registradas'],
  ]
    .map(
      ([label, value, hint]) =>
        `<div class="stat"><span class="stat-label">${esc(label)}</span><span class="stat-value">${value}</span><p class="stat-hint">${esc(hint)}</p></div>`
    )
    .join('');

  // Cabeceras con indicador de orden
  document.querySelectorAll('th.sortable').forEach((th) => {
    const base = th.textContent.replace(/[▲▼]\s*$/, '').trim();
    th.innerHTML = th.dataset.sort === sortBy ? `${esc(base)}<span class="arrow">${sortDir === 'asc' ? '▲' : '▼'}</span>` : esc(base);
  });

  // Filas
  $('tbody').innerHTML = rows
    .map((b) => {
      const tel = String(b.phone || '').replace(/[^\d]/g, '');
      return `<tr class="${b.date < hoy ? 'is-past' : ''}">
      <td class="cell-date">${esc(fechaCorta(b.date))}<span class="cell-time">${esc(b.time)} h · 1 hora</span></td>
      <td><span class="cell-name">${esc(b.name)}</span><span class="cell-sub">#${esc(b.id)}</span></td>
      <td class="cell-contact"><a href="mailto:${esc(b.email)}">${esc(b.email)}</a><span class="cell-sub"><a href="https://wa.me/${esc(tel)}" target="_blank" rel="noopener">${esc(b.phone)}</a></span></td>
      <td><span class="pill ${b.date === hoy ? 'pill-today' : ''}">${esc(b.service)}</span></td>
      <td class="cell-notes ${b.notes ? '' : 'none'}">${esc(b.notes || '—')}</td>
      <td class="col-actions"><button class="btn btn-sm btn-danger btn-icon" data-cancel="${esc(b.id)}">Cancelar</button></td>
    </tr>`;
    })
    .join('');

  $('empty').classList.toggle('hidden', rows.length > 0);
  $('footNote').textContent = `Mostrando ${rows.length} de ${ALL.length} reservas · actualizado ${new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`;

  $('tbody').querySelectorAll('[data-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(Number(btn.dataset.cancel)));
  });
}

/* ------------------------------------------------------------------ */
/* Cancelación                                                        */
/* ------------------------------------------------------------------ */

function openModal(id) {
  pending = ALL.find((b) => Number(b.id) === id);
  if (!pending) return;
  $('modalBody').innerHTML = `Vas a cancelar el turno de <strong>${esc(pending.name)}</strong> del <strong>${esc(fechaCorta(pending.date))} a las ${esc(pending.time)} h</strong> (${esc(pending.service)}).<br /><br />El bloque queda libre para que otra persona lo reserve. Esta acción no se puede deshacer.`;
  $('notify').checked = true;
  $('modal').classList.remove('hidden');
}

function closeModal() {
  $('modal').classList.add('hidden');
  pending = null;
}

$('modalCancel').addEventListener('click', closeModal);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  closeModal();
  $('diagModal').classList.add('hidden');
});

$('modalConfirm').addEventListener('click', async () => {
  if (!pending) return;
  const btn = $('modalConfirm');
  btn.disabled = true;
  btn.textContent = 'Cancelando…';
  try {
    const notify = $('notify').checked ? '1' : '0';
    const res = await fetch(`/api/bookings?key=${encodeURIComponent(KEY)}&id=${pending.id}&notify=${notify}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error al cancelar.');
    ALL = ALL.filter((b) => Number(b.id) !== Number(pending.id));
    closeModal();
    buildServiceFilter();
    render();
  } catch (err) {
    $('modalBody').innerHTML = `<span style="color:#ff8686;">${esc(err.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Cancelar reserva';
  }
});

/* ------------------------------------------------------------------ */
/* Diagnóstico                                                        */
/* ------------------------------------------------------------------ */

$('diagBtn').addEventListener('click', () => {
  $('diagModal').classList.remove('hidden');
  $('testMsg').textContent = '';
  loadDiag();
});
$('diagClose').addEventListener('click', () => $('diagModal').classList.add('hidden'));
$('diagModal').addEventListener('click', (e) => { if (e.target === $('diagModal')) $('diagModal').classList.add('hidden'); });

const ESTADO_OK = /^(OK|configurada|.*verificado$|.*disponibles.*)/i;

function bloque(titulo, obj) {
  const filas = Object.entries(obj || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      const txt = String(v);
      const malo = /FALTA|ERROR|NO está|SIN VERIFICAR|rechazada|FALLÓ|no se pudo/i.test(txt);
      const bueno = ESTADO_OK.test(txt);
      return `<tr><td class="diag-k">${esc(k.replace(/_/g, ' '))}</td><td class="diag-v ${malo ? 'bad' : bueno ? 'good' : ''}">${esc(txt)}</td></tr>`;
    })
    .join('');
  if (!filas) return '';
  return `<h4 class="diag-h">${esc(titulo)}</h4><table class="diag-table">${filas}</table>`;
}

async function loadDiag() {
  const box = $('diagBody');
  box.innerHTML = '<p class="diag-loading">Consultando…</p>';
  try {
    const res = await fetch(`/api/diag?key=${encodeURIComponent(KEY)}`);
    if (!res.ok) throw new Error(`El servidor respondió ${res.status}. ¿Está desplegada la última versión?`);
    const d = await res.json();

    const problemas = (d.problemas || []).length
      ? `<div class="diag-alert bad"><strong>${d.problemas.length} problema(s)</strong><ul>${d.problemas.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`
      : `<div class="diag-alert good"><strong>${esc(d.resumen || 'Todo en orden.')}</strong></div>`;

    const pasos = (d.siguientes_pasos || []).length
      ? `<div class="diag-alert"><strong>Siguientes pasos</strong><ul>${d.siguientes_pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`
      : '';

    box.innerHTML =
      problemas +
      pasos +
      bloque('Emails (Brevo)', d.emails) +
      bloque('Base de datos', d.base_de_datos) +
      bloque('Variables de entorno', d.variables) +
      bloque('Deploy', d.deploy);
  } catch (err) {
    box.innerHTML = `<div class="diag-alert bad"><strong>No se pudo obtener el diagnóstico</strong><p>${esc(err.message)}</p></div>`;
  }
}

$('testBtn').addEventListener('click', async () => {
  const email = $('testEmail').value.trim();
  const msg = $('testMsg');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msg.textContent = 'Poné un email válido.';
    msg.className = 'form-msg err';
    return;
  }
  const btn = $('testBtn');
  btn.disabled = true;
  msg.textContent = 'Enviando…';
  msg.className = 'form-msg';
  try {
    const res = await fetch(`/api/diag?key=${encodeURIComponent(KEY)}&test=${encodeURIComponent(email)}`);
    const d = await res.json();
    const r = String(d.emails?.prueba || '');
    const ok = r.includes('enviado');
    msg.textContent = ok ? `✓ ${r}` : `✗ ${r}${d.emails?.prueba_detalle ? ' · ' + d.emails.prueba_detalle : ''}`;
    msg.className = 'form-msg ' + (ok ? 'ok' : 'err');
    loadDiag();
  } catch {
    msg.textContent = 'Error de conexión.';
    msg.className = 'form-msg err';
  } finally {
    btn.disabled = false;
  }
});

/* ------------------------------------------------------------------ */
/* Arranque: si ya hay clave guardada, entra directo                  */
/* ------------------------------------------------------------------ */

(async () => {
  let saved = '';
  try { saved = localStorage.getItem(STORE_KEY) || ''; } catch {}
  if (saved) await tryKey(saved);
})();
