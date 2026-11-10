// Envía un "toque" Web Push vacío al móvil. La app, al recibirlo, monta el resumen
// con las tareas guardadas en el propio móvil (aquí no viaja ninguna tarea).
// Sin dependencias: firma VAPID (ES256) con el módulo crypto de Node.
import crypto from 'node:crypto';

// Secreto AVISO_CONFIG = {"publicKey": "...", "privateKey": "...", "subscription": {...}}
const { AVISO_CONFIG, FORZAR } = process.env;
if (!AVISO_CONFIG) { console.log('Falta el secreto AVISO_CONFIG. Nada que enviar.'); process.exit(0); }
const cfg = JSON.parse(AVISO_CONFIG);
const VAPID_PUBLIC = cfg.publicKey, VAPID_PRIVATE = cfg.privateKey;

// Hora objetivo 7:58 en Madrid. El cron corre a las 5:58 y 6:58 UTC (cubre horario de invierno y verano);
// solo envía la ejecución que cae entre 7:58 y 8:53 hora de Madrid, aunque GitHub la retrase.
const partes = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).formatToParts(new Date()).map(p => [p.type, p.value]));
const minutos = +partes.hour * 60 + +partes.minute;
const desdeObjetivo = minutos - (7 * 60 + 58);
console.log(`Hora en Madrid: ${partes.hour}:${partes.minute}`);
if (FORZAR !== 'true' && (desdeObjetivo < 0 || desdeObjetivo >= 55)) {
  console.log('Fuera de la ventana de las 8:00, no se envía.');
  process.exit(0);
}

const b64u = b => Buffer.from(b).toString('base64url');
const sub = cfg.subscription;
const pub = Buffer.from(VAPID_PUBLIC, 'base64url');
const clave = crypto.createPrivateKey({
  key: { kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
  format: 'jwk'
});
const cab = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
const datos = b64u(JSON.stringify({
  aud: new URL(sub.endpoint).origin,
  exp: Math.floor(Date.now() / 1000) + 12 * 3600,
  sub: 'https://alejandro130196.github.io/mis-tareas/'
}));
const firma = crypto.sign('sha256', Buffer.from(`${cab}.${datos}`), { key: clave, dsaEncoding: 'ieee-p1363' });
const jwt = `${cab}.${datos}.${b64u(firma)}`;

const r = await fetch(sub.endpoint, {
  method: 'POST',
  headers: { Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`, TTL: '3600', Urgency: 'high', 'Content-Length': '0' }
});
console.log(`Respuesta del servicio de push: ${r.status}`);
if (r.status === 404 || r.status === 410) {
  console.log('La suscripción ya no es válida: vuelve a activar el aviso en la app y actualiza el secreto AVISO_CONFIG.');
  process.exit(1);
}
if (!r.ok) { console.log(await r.text()); process.exit(1); }
console.log('Aviso enviado ✓');
