'use strict';

const CLAVE = 'mis-tareas-v1';
const ORDEN_P = { alta: 0, media: 1, baja: 2 };
const NOMBRE_P = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const $ = s => document.querySelector(s);

let tareas = cargar();
let tab = 'hoy';
let editando = null;
let deshacer = null;

// ---------- Datos ----------
function cargar() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || []; } catch { return []; }
}
function guardar() {
  localStorage.setItem(CLAVE, JSON.stringify(tareas));
  copiaParaAviso();
}
// El service worker no puede leer localStorage: le dejamos una copia en la caché
function copiaParaAviso() {
  if (!('caches' in window)) return;
  caches.open('mis-tareas-datos')
    .then(c => c.put('datos/tareas.json', new Response(JSON.stringify(tareas), { headers: { 'Content-Type': 'application/json' } })))
    .catch(() => {});
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hoyStr = () => Parser.ymd(new Date());
function difDias(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const a = new Date(y, m - 1, d), h = new Date(); h.setHours(0, 0, 0, 0);
  return Math.round((a - h) / 86400000);
}
function textoFecha(fecha) {
  const n = difDias(fecha);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  if (n < 0) return `Hace ${-n} días`;
  const [y, m, d] = fecha.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  const opts = n < 7 ? { weekday: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' };
  if (f.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  const s = f.toLocaleDateString('es-ES', opts);
  return s[0].toUpperCase() + s.slice(1);
}
const porFechaYPrio = (a, b) =>
  (a.fecha || '9999') .localeCompare(b.fecha || '9999') || ORDEN_P[a.prioridad] - ORDEN_P[b.prioridad] || a.creada - b.creada;
const porPrioYFecha = (a, b) =>
  ORDEN_P[a.prioridad] - ORDEN_P[b.prioridad] || (a.fecha || '9999').localeCompare(b.fecha || '9999') || a.creada - b.creada;

// ---------- Render ----------
const ICO_CHECK = '<svg viewBox="0 0 24 24"><path d="m9 16.2-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z"/></svg>';
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function itemHTML(t) {
  let vence = '';
  if (t.fecha && !t.hecha) {
    const n = difDias(t.fecha);
    vence = `<span class="vence ${n < 0 ? 'tarde' : n === 0 ? 'hoy' : ''}">${textoFecha(t.fecha)}</span>`;
  }
  const cerrada = t.hecha ? `<span>Hecha ${textoFecha(t.hecha).toLowerCase()}</span>` : '';
  const nota = t.notas ? `<span class="nota">${esc(t.notas)}</span>` : '';
  return `<li class="tarea${t.hecha ? ' hecha' : ''}" data-p="${t.prioridad}" data-id="${t.id}">
    <button class="check" data-acc="check" aria-label="${t.hecha ? 'Reabrir' : 'Marcar como hecha'}">${ICO_CHECK}</button>
    <button class="cuerpo" data-acc="editar">
      <span class="t">${esc(t.titulo)}</span>
      <span class="meta"><span class="pill">${NOMBRE_P[t.prioridad]}</span>${vence}${cerrada}${nota}</span>
    </button>
  </li>`;
}
function seccion(titulo, lista, clase = '') {
  if (!lista.length) return '';
  return `<section><h2>${titulo} <span class="n">· ${lista.length}</span></h2>
    <ul class="lista ${clase}">${lista.map(itemHTML).join('')}</ul></section>`;
}

function render() {
  const pend = tareas.filter(t => !t.hecha);
  const hoy = hoyStr();
  { const f = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); $('#fecha').textContent = f[0].toUpperCase() + f.slice(1); }
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  let html = '';

  if (tab === 'hoy') {
    $('#titulo').textContent = 'Hoy';
    const vencidas = pend.filter(t => t.fecha && t.fecha < hoy).sort(porFechaYPrio);
    const deHoy = pend.filter(t => t.fecha === hoy);
    const altas = pend.filter(t => t.prioridad === 'alta' && (!t.fecha || t.fecha > hoy));
    const foco = [...deHoy, ...altas].sort(porPrioYFecha);
    const semana = pend.filter(t => t.prioridad !== 'alta' && t.fecha && t.fecha > hoy && difDias(t.fecha) <= 7).sort(porFechaYPrio);
    const usados = new Set([...vencidas, ...foco, ...semana].map(t => t.id));
    const resto = pend.filter(t => !usados.has(t.id));

    if (!pend.length) {
      html = `<div class="vacio"><strong>Nada pendiente</strong>Dicta o escribe una tarea abajo.</div>`;
    } else {
      const empezar = vencidas[0] || foco[0] || semana[0] || resto.sort(porPrioYFecha)[0];
      html += `<div class="foco">Empieza por: <b>${esc(empezar.titulo)}</b></div>`;
      html += seccion('⚠️ Vencidas', vencidas, 'vencidas');
      html += seccion('🎯 Foco de hoy', foco);
      html += seccion('📅 Próximos 7 días', semana);
      if (resto.length) {
        const a = resto.filter(t => t.prioridad === 'media').length, b = resto.length - a;
        html += `<section><button class="resto" data-ir="todas">Resto pendiente: ${a} media · ${b} baja ›</button></section>`;
      }
    }
  } else if (tab === 'todas') {
    $('#titulo').textContent = 'Todas';
    if (!pend.length) html = `<div class="vacio"><strong>Sin tareas pendientes</strong></div>`;
    for (const p of ['alta', 'media', 'baja']) {
      html += seccion({ alta: '🔴 Alta', media: '🟡 Media', baja: '🟢 Baja' }[p], pend.filter(t => t.prioridad === p).sort(porFechaYPrio));
    }
  } else {
    $('#titulo').textContent = 'Hechas';
    const hechas = tareas.filter(t => t.hecha).sort((a, b) => b.hecha.localeCompare(a.hecha));
    html = hechas.length ? seccion('Completadas', hechas) : `<div class="vacio"><strong>Aún nada</strong>Las tareas que cierres aparecerán aquí.</div>`;
  }
  $('#vista').innerHTML = html;
}

// ---------- Acciones ----------
function toast(txt, accion) {
  $('#toast-txt').textContent = txt;
  $('#toast-btn').hidden = !accion;
  deshacer = accion || null;
  $('#toast').hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { $('#toast').hidden = true; deshacer = null; }, 4500);
}

function anadir(texto) {
  const r = Parser.parse(texto);
  if (!r.titulo) return;
  const t = { id: uid(), titulo: r.titulo, prioridad: r.prioridad, fecha: r.fecha, notas: r.notas, creada: Date.now(), hecha: null };
  tareas.push(t);
  guardar(); render();
  const extra = [NOMBRE_P[t.prioridad], t.fecha ? textoFecha(t.fecha).toLowerCase() : null].filter(Boolean).join(' · ');
  toast(`Añadida (${extra})`, () => { tareas = tareas.filter(x => x.id !== t.id); guardar(); render(); });
}

function alternar(id) {
  const t = tareas.find(x => x.id === id);
  if (!t) return;
  const antes = t.hecha;
  t.hecha = t.hecha ? null : hoyStr();
  guardar(); render();
  if (t.hecha) toast('Hecha ✓', () => { t.hecha = antes; guardar(); render(); });
}

function abrirEditor(id) {
  const t = tareas.find(x => x.id === id);
  if (!t) return;
  editando = t;
  $('#e-titulo').value = t.titulo;
  document.querySelector(`input[name="e-prio"][value="${t.prioridad}"]`).checked = true;
  $('#e-fecha').value = t.fecha || '';
  $('#e-notas').value = t.notas || '';
  $('#editor').showModal();
}

$('#form-editor').addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok' || !editando) return;
  const titulo = $('#e-titulo').value.trim();
  if (!titulo) { e.preventDefault(); return; }
  editando.titulo = titulo;
  editando.prioridad = document.querySelector('input[name="e-prio"]:checked').value;
  editando.fecha = $('#e-fecha').value || null;
  editando.notas = $('#e-notas').value.trim();
  guardar(); render();
});
$('#editor').addEventListener('close', () => { editando = null; });
$('#e-sin-fecha').addEventListener('click', () => { $('#e-fecha').value = ''; });
$('#e-borrar').addEventListener('click', () => {
  if (!editando) return;
  const t = editando, i = tareas.indexOf(t);
  tareas.splice(i, 1);
  guardar(); $('#editor').close(); render();
  toast('Tarea borrada', () => { tareas.splice(i, 0, t); guardar(); render(); });
});

$('#vista').addEventListener('click', e => {
  const ir = e.target.closest('[data-ir]');
  if (ir) { tab = ir.dataset.ir; render(); scrollTo(0, 0); return; }
  const b = e.target.closest('[data-acc]');
  if (!b) return;
  const id = b.closest('.tarea').dataset.id;
  if (b.dataset.acc === 'check') alternar(id); else abrirEditor(id);
});
document.querySelectorAll('.tabs button').forEach(b =>
  b.addEventListener('click', () => { tab = b.dataset.tab; render(); scrollTo(0, 0); }));
$('#toast-btn').addEventListener('click', () => { deshacer?.(); deshacer = null; $('#toast').hidden = true; });

$('#captura').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#entrada').value.trim();
  if (!v) { $('#entrada').focus(); return; }
  anadir(v);
  $('#entrada').value = '';
});

// ---------- Voz ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = $('#btn-mic');
  mic.hidden = false;
  let rec = null;
  mic.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = 'es-ES';
    rec.interimResults = true;
    rec.continuous = false;
    let final = '';
    rec.onresult = ev => {
      let parcial = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript; else parcial += ev.results[i][0].transcript;
      }
      $('#entrada').value = (final + parcial).trim();
    };
    rec.onerror = ev => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast('Sin permiso de micrófono. Usa el micro del teclado.');
      else if (ev.error !== 'no-speech' && ev.error !== 'aborted') toast('No se pudo dictar. Prueba con el micro del teclado.');
    };
    rec.onend = () => {
      mic.classList.remove('on'); rec = null;
      const v = $('#entrada').value.trim();
      if (final.trim() && v) { anadir(v); $('#entrada').value = ''; }
    };
    mic.classList.add('on');
    try { rec.start(); } catch { mic.classList.remove('on'); rec = null; }
  });
}

// ---------- Menú: copia de seguridad ----------
$('#btn-menu').addEventListener('click', () => $('#menu').showModal());
$('#m-exportar').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'mis-tareas', version: 1, exportada: new Date().toISOString(), tareas }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mis-tareas-${hoyStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#m-importar').addEventListener('click', () => $('#m-fichero').click());
$('#m-fichero').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const datos = JSON.parse(await f.text());
    const lista = Array.isArray(datos) ? datos : datos.tareas;
    if (!Array.isArray(lista)) throw new Error();
    const ids = new Set(tareas.map(t => t.id));
    const nuevas = lista.filter(t => t && t.id && t.titulo && !ids.has(t.id))
      .map(t => ({ prioridad: 'media', fecha: null, notas: '', hecha: null, creada: Date.now(), ...t }));
    tareas.push(...nuevas);
    guardar(); render(); $('#menu').close();
    toast(`Importadas ${nuevas.length} tareas`);
  } catch { toast('Ese fichero no es una copia válida'); }
  e.target.value = '';
});
$('#m-limpiar').addEventListener('click', () => {
  const antes = tareas.length;
  tareas = tareas.filter(t => !t.hecha || difDias(t.hecha) > -30);
  guardar(); render(); $('#menu').close();
  toast(`Borradas ${antes - tareas.length} tareas antiguas`);
});

// Cerrar hojas tocando fuera
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

// Refrescar al volver a la app (cambia el día, vencidas, etc.)
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tareas = cargar(); render(); } });

// ---------- Aviso a las 8:00 (Web Push: GitHub Actions envía un toque y la app monta el resumen) ----------
const VAPID_PUBLICA = 'BKIru1dn2qb7nzSBNHda-cCQRHbzsikBoADodr1EFTSqVHB_pXnXhlONJ07UEKKxIz7sEqcIdN7pZO96TSYaofM';
const b64aBytes = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };

async function estadoAviso() {
  const el = $('#aviso-estado'), btn = $('#m-aviso'), caja = $('#aviso-codigo');
  caja.hidden = true;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    el.textContent = 'Este navegador no permite avisos. Usa Chrome en Android con la app instalada.';
    btn.hidden = true; return;
  }
  const reg = await navigator.serviceWorker.ready;
  reg.periodicSync?.unregister?.('resumen-diario').catch(() => {});
  const sub = await reg.pushManager.getSubscription();
  if (sub && Notification.permission === 'granted') {
    btn.textContent = 'Ver código / probar aviso';
    el.textContent = 'Aviso activado en este móvil. Si aún no lo has hecho, pásale el código a Claude.';
  } else {
    btn.textContent = 'Activar aviso a las 8:00';
    el.textContent = 'Cada mañana a las 8:00 (puede llegar hasta las 8:15) te avisa con vencidas, foco del día y próximos 7 días.';
  }
}

async function activarAviso() {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') { toast('Sin permiso de notificaciones'); return; }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(VAPID_PUBLICA) });
    } catch { toast('No se pudo activar. Abre la app desde el icono instalado y reintenta'); return; }
  }
  copiaParaAviso();
  reg.active?.postMessage('probar-aviso');
  const codigo = JSON.stringify(sub.toJSON());
  $('#aviso-txt').value = codigo;
  $('#aviso-codigo').hidden = false;
  $('#aviso-estado').textContent = 'Te ha llegado un aviso de prueba. Copia este código y pégaselo a Claude (solo hace falta una vez):';
  $('#m-aviso').textContent = 'Ver código / probar aviso';
}
$('#aviso-copiar').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#aviso-txt').value); toast('Código copiado'); }
  catch { $('#aviso-txt').select(); toast('Mantén pulsado el texto para copiarlo'); }
});
$('#m-aviso').addEventListener('click', activarAviso);
$('#btn-menu').addEventListener('click', estadoAviso);

// ---------- Arranque ----------
render();
copiaParaAviso();
if (new URLSearchParams(location.search).has('nueva')) $('#entrada').focus();
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
