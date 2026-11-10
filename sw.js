// Service worker: app sin conexión + aviso de las 8:00 con el resumen de tareas.
// Al cambiar cualquier archivo, sube VERSION para que los móviles se actualicen.
const VERSION = 'v3';
const CACHE = `mis-tareas-${VERSION}`;
const DATOS = 'mis-tareas-datos';
const ARCHIVOS = [
  './', 'index.html', 'styles.css', 'app.js', 'parse.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/badge-96.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => /^mis-tareas-v\d+$/.test(k) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// ---------- Aviso diario ----------
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ORDEN_P = { alta: 0, media: 1, baja: 2 };

function difDias(fecha, hoy) {
  const [y, m, d] = fecha.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - hoy) / 86400000);
}

async function resumen(forzar) {
  const ahora = new Date();
  const hoy = ymd(ahora);
  const cache = await caches.open(DATOS);

  if (!forzar) {
    const ult = await cache.match('datos/ultimo-aviso');
    if (ult && (await ult.text()) === hoy) return;          // ya avisé hoy
    const h = ahora.getHours();
    if (h < 7 || h >= 21) return;                            // no molestar de noche
  }

  const r = await cache.match('datos/tareas.json');
  const tareas = r ? await r.json() : [];
  const h0 = new Date(ahora); h0.setHours(0, 0, 0, 0);
  const pend = tareas.filter(t => !t.hecha);
  const vencidas = pend.filter(t => t.fecha && t.fecha < hoy);
  const foco = pend.filter(t => t.fecha === hoy || (t.prioridad === 'alta' && (!t.fecha || t.fecha > hoy)))
    .sort((a, b) => ORDEN_P[a.prioridad] - ORDEN_P[b.prioridad]);
  const semana = pend.filter(t => t.prioridad !== 'alta' && t.fecha && t.fecha > hoy && difDias(t.fecha, h0) <= 7);
  const empezar = vencidas[0] || foco[0] || semana[0] || pend.sort((a, b) => ORDEN_P[a.prioridad] - ORDEN_P[b.prioridad])[0];

  let titulo, cuerpo;
  if (!pend.length) {
    titulo = 'Mis tareas · Nada pendiente';
    cuerpo = 'Día limpio. Apunta lo que vaya saliendo.';
  } else {
    const partes = [];
    if (vencidas.length) partes.push(`⚠️ ${vencidas.length} vencida${vencidas.length > 1 ? 's' : ''}`);
    if (foco.length) partes.push(`🎯 ${foco.length} de foco`);
    if (semana.length) partes.push(`📅 ${semana.length} esta semana`);
    titulo = `Mis tareas · ${pend.length} pendiente${pend.length > 1 ? 's' : ''}`;
    cuerpo = (partes.length ? partes.join(' · ') + '\n' : '') + `Empieza por: ${empezar.titulo}`;
  }

  await self.registration.showNotification(titulo, {
    body: cuerpo,
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    tag: 'resumen-diario',
    renotify: true,
    data: { url: './' }
  });
  if (!forzar) await cache.put('datos/ultimo-aviso', new Response(hoy));
}

// GitHub Actions manda un push vacío a las 8:00: aquí se monta el resumen con los datos del móvil
self.addEventListener('push', e => {
  e.waitUntil(resumen(true));
});

self.addEventListener('message', e => {
  if (e.data === 'probar-aviso') e.waitUntil(resumen(true));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./');
    })
  );
});
