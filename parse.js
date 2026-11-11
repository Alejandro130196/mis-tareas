// Interpreta una frase dictada o escrita: prioridad, fecha límite y notas.
// Ej.: "revisar curva de cocción horno 2 alta para el viernes nota: con Juan"
(function (root) {
  const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const NUM = {
    uno: 1, un: 1, primero: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
    nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16,
    diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22,
    veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
    veintiocho: 28, veintinueve: 29, treinta: 30, 'treinta y uno': 31
  };

  // Quita tildes manteniendo la longitud (para que los índices coincidan con el original)
  const plano = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sumaDias = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const numero = t => (/^\d+$/.test(t) ? parseInt(t, 10) : NUM[t]);
  const NUMRX = '(\\d{1,2}|treinta y uno|' + Object.keys(NUM).filter(k => k !== 'treinta y uno').join('|') + ')';
  const PREP = '(?:para\\s+(?:el\\s+|la\\s+)?|antes\\s+del?\\s+|hasta\\s+el\\s+|como\\s+tarde\\s+el\\s+|el\\s+|la\\s+)?';

  function fechaValida(y, m, d) {
    const f = new Date(y, m, d);
    return f.getMonth() === m && f.getDate() === d ? f : null;
  }

  // Cada regla: [regex sobre texto plano, función que devuelve Date | null]
  function reglas(hoy) {
    return [
      [new RegExp(`\\b${PREP}pasado\\s+manana\\b`), () => sumaDias(hoy, 2)],
      [new RegExp(`\\b${PREP}manana\\b`), () => sumaDias(hoy, 1)],
      [new RegExp(`\\b${PREP}hoy\\b`), () => new Date(hoy)],
      [new RegExp(`\\b${PREP}fin\\s+de\\s+mes\\b`), () => new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)],
      [new RegExp(`\\b${PREP}(?:la\\s+)?(?:semana\\s+que\\s+viene|proxima\\s+semana)\\b`), () => {
        const n = ((8 - hoy.getDay()) % 7) || 7; return sumaDias(hoy, n); // próximo lunes
      }],
      [new RegExp(`\\b(?:en|dentro\\s+de)\\s+${NUMRX}\\s+(dias?|semanas?)\\b`), m => {
        const n = numero(m[1]); return n ? sumaDias(hoy, m[2].startsWith('semana') ? n * 7 : n) : null;
      }],
      [new RegExp(`\\b${PREP}(?:dia\\s+)?(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?\\b`), m => {
        const d = +m[1], mes = +m[2] - 1;
        let y = m[3] ? +m[3] : hoy.getFullYear(); if (y < 100) y += 2000;
        let f = fechaValida(y, mes, d);
        if (f && !m[3] && f < hoy) f = fechaValida(y + 1, mes, d);
        return f;
      }],
      [new RegExp(`\\b${PREP}(?:dia\\s+)?${NUMRX}\\s+de\\s+(${MESES.join('|')})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`), m => {
        const d = numero(m[1]), mes = MESES.indexOf(m[2]);
        let y = m[3] ? +m[3] : hoy.getFullYear();
        let f = fechaValida(y, mes, d);
        if (f && !m[3] && f < hoy) f = fechaValida(y + 1, mes, d);
        return f;
      }],
      [new RegExp(`\\b${PREP}(?:este\\s+|el\\s+proximo\\s+|proximo\\s+)?(${DIAS.join('|')})(?:\\s+que\\s+viene)?\\b`), m => {
        const n = ((DIAS.indexOf(m[1]) - hoy.getDay() + 7) % 7) || 7; return sumaDias(hoy, n);
      }],
      [new RegExp(`\\b(?:para\\s+el\\s+|antes\\s+del\\s+|hasta\\s+el\\s+|el\\s+)dia\\s+${NUMRX}\\b|\\b(?:para\\s+el|antes\\s+del|hasta\\s+el)\\s+${NUMRX}\\b(?!\\s*(?:de|[/.-]|%|horas?|h\\b|min))`), m => {
        const d = numero(m[1] || m[2]); if (!d || d > 31) return null;
        let f = fechaValida(hoy.getFullYear(), hoy.getMonth(), d);
        if (!f || f < hoy) f = fechaValida(hoy.getFullYear(), hoy.getMonth() + 1, d);
        return f;
      }]
    ];
  }

  function quitar(texto, inicio, fin) {
    return (texto.slice(0, inicio) + ' ' + texto.slice(fin)).replace(/\s{2,}/g, ' ');
  }

  function parse(entrada, hoyRef) {
    const hoy = hoyRef ? new Date(hoyRef) : new Date();
    hoy.setHours(0, 0, 0, 0);
    let texto = ' ' + String(entrada || '').normalize('NFC').trim() + ' ';
    let notas = '';
    let prioridad = null;
    let fecha = null;

    // Órdenes iniciales habituales al dictar
    texto = texto.replace(/^\s*(?:añade|añadir|apunta|apuntar|nueva tarea|tarea|recuérdame|recuerdame)\s*:?\s*(?:que\s+)?/i, ' ');

    // Notas: todo lo que va tras "nota(s)"
    const mn = plano(texto).match(/\s(?:nota|notas|observaciones)\s*:?\s+/);
    if (mn) { notas = texto.slice(mn.index + mn[0].length).trim(); texto = texto.slice(0, mn.index) + ' '; }

    // Prioridad explícita
    const reglasPrio = [
      [/[\s,]prioridad\s+(alta|media|baja)\b/, m => m[1]],
      [/[\s,](?:es\s+)?(?:muy\s+)?(urgente|importante)\b/, () => 'alta'],
      [/[\s,](?:sin\s+prisa|cuando\s+pueda)\b/, () => 'baja']
    ];
    for (const [rx, fn] of reglasPrio) {
      const m = plano(texto).match(rx);
      if (m) { prioridad = fn(m); texto = quitar(texto, m.index, m.index + m[0].length); break; }
    }

    // Fecha
    for (const [rx, fn] of reglas(hoy)) {
      const p = plano(texto);
      const m = p.match(rx);
      if (!m) continue;
      const f = fn(m);
      if (f) { fecha = ymd(f); texto = quitar(texto, m.index, m.index + m[0].length); break; }
    }

    // Proyecto: "… proyecto línea 4" (hasta el final de la frase)
    let proyecto = null;
    {
      const p = plano(texto);
      const m = p.match(/[\s,](?:del?\s+|en\s+el\s+|para\s+el\s+)?proyecto\s*:?\s+/);
      if (m) {
        proyecto = texto.slice(m.index + m[0].length).replace(/[\s,.;]+$/, '').trim() || null;
        texto = texto.slice(0, m.index) + ' ';
        // la prioridad puede ir justo después del proyecto: "proyecto horno alta"
        if (proyecto && !prioridad) {
          const mp = plano(proyecto).match(/\s(alta|media|baja)$/);
          if (mp) { prioridad = mp[1]; proyecto = proyecto.slice(0, mp.index).trim(); }
        }
      }
    }

    // Duración estimada: "3 días eléctrico", "eléctrico duración 3 días", "dura 2 días"
    let duracion = null;
    {
      const p = plano(texto);
      const m = p.match(new RegExp(`^\\s*${NUMRX}\\s+dias?\\s+(?:de\\s+)?`)) ||
                p.match(new RegExp(`[\\s,](?:duracion|dura|lleva)\\s*:?\\s*(?:de\\s+)?${NUMRX}\\s+dias?\\b`)) ||
                p.match(new RegExp(`[\\s,]${NUMRX}\\s+dias?(?=\\s*[,.]?\\s*(?:(?:alta|media|baja)\\s*[,.]?\\s*)?$)`));
      if (m) { const n = numero(m[1]); if (n) { duracion = n; texto = quitar(texto, m.index, m.index + m[0].length); } }
    }

    // "alta/media/baja" sueltas al final o tras una coma (para no romper "dar de alta")
    if (!prioridad) {
      const p = plano(texto);
      const m = p.match(/(?:,\s*|\s)(alta|media|baja)\s*[,.]?\s*$/) || p.match(/,\s*(alta|media|baja)\s*(?=,)/);
      if (m && !/\bde\s+(alta|baja)\s*[,.]?\s*$/.test(p.slice(0, m.index + m[0].length))) {
        prioridad = m[1]; texto = quitar(texto, m.index, m.index + m[0].length);
      }
    }

    let titulo = texto.replace(/\s+([,.;])/g, '$1').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ');
    if (titulo) titulo = titulo[0].toUpperCase() + titulo.slice(1);

    if (proyecto) proyecto = proyecto[0].toUpperCase() + proyecto.slice(1);
    return { titulo, prioridad: prioridad || 'media', fecha, notas, proyecto, duracion, prioridadDicha: !!prioridad };
  }

  const api = { parse, ymd };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parser = api;
})(typeof window !== 'undefined' ? window : globalThis);
