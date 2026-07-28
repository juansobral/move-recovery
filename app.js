// MOVE Recovery Room - front-end de reservas
const $ = (id) => document.getElementById(id);
const dateInput = $('date');
const serviceSelect = $('service');
const slotsEl = $('slots');
const form = $('form');
const submitBtn = $('submitBtn');
const selectedSlotEl = $('selectedSlot');
const msgEl = $('msg');

let selectedTime = null;

$('year').textContent = new Date().getFullYear();

// Fecha mínima = hoy, valor inicial = hoy
const today = new Date().toISOString().slice(0, 10);
dateInput.min = today;
dateInput.value = today;

const fmtTime = (t) => `${t} – ${String(Number(t.slice(0, 2)) + 1).padStart(2, '0')}:00`;

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const { servicios } = await res.json();
    serviceSelect.innerHTML = servicios.map((s) => `<option value="${s}">${s}</option>`).join('');
  } catch {
    serviceSelect.innerHTML = '<option value="Recovery Room">Recovery Room</option>';
  }
}

async function loadAvailability() {
  selectedTime = null;
  updateSelected();
  slotsEl.innerHTML = '<p class="hint">Cargando disponibilidad…</p>';
  try {
    const res = await fetch(`/api/availability?date=${dateInput.value}`);
    if (!res.ok) throw new Error();
    const { slots } = await res.json();
    slotsEl.innerHTML = '';
    slots.forEach(({ time, available }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.textContent = time;
      b.disabled = !available;
      b.title = available ? fmtTime(time) : 'No disponible';
      b.addEventListener('click', () => selectSlot(time, b));
      slotsEl.appendChild(b);
    });
    if (slots.every((s) => !s.available)) {
      slotsEl.insertAdjacentHTML('beforeend', '<p class="hint">Sin horarios disponibles para esta fecha.</p>');
    }
  } catch {
    slotsEl.innerHTML = '<p class="hint">No se pudo cargar la disponibilidad. Reintentá.</p>';
  }
}

function selectSlot(time, el) {
  selectedTime = time;
  document.querySelectorAll('.slot').forEach((s) => s.classList.remove('selected'));
  el.classList.add('selected');
  updateSelected();
}

function updateSelected() {
  if (selectedTime) {
    selectedSlotEl.textContent = `${dateInput.value} · ${fmtTime(selectedTime)}`;
    selectedSlotEl.classList.add('active');
    submitBtn.disabled = false;
  } else {
    selectedSlotEl.textContent = 'Ningún horario seleccionado';
    selectedSlotEl.classList.remove('active');
    submitBtn.disabled = true;
  }
}

function setMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = 'form-msg' + (type ? ' ' + type : '');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedTime) return;
  submitBtn.disabled = true;
  setMsg('Enviando…', '');

  const payload = {
    date: dateInput.value,
    time: selectedTime,
    service: serviceSelect.value,
    name: $('name').value,
    email: $('email').value,
    phone: $('phone').value,
    notes: $('notes').value,
  };

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || 'No se pudo confirmar la reserva.', 'err');
      submitBtn.disabled = false;
      await loadAvailability();
      return;
    }
    setMsg(
      data.emailSent
        ? `✓ Reserva confirmada: ${payload.date} a las ${selectedTime}. Te enviamos un mail a ${payload.email} con el protocolo y qué llevar. ¡Te esperamos!`
        : `✓ Reserva confirmada: ${payload.date} a las ${selectedTime}. ¡Te esperamos! (No pudimos enviarte el mail con el protocolo; te escribimos por WhatsApp.)`,
      'ok'
    );
    form.reset();
    selectedTime = null;
    updateSelected();
    dateInput.value = payload.date;
    await loadAvailability();
  } catch {
    setMsg('Error de conexión. Intentá nuevamente.', 'err');
    submitBtn.disabled = false;
  }
});

dateInput.addEventListener('change', loadAvailability);

loadConfig();
loadAvailability();
