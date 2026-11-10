# Mis tareas

App web instalable (PWA) para apuntar tareas dictando, con prioridades y una pantalla **Hoy** que resume lo pendiente.

- 🎙️ **Dictado**: botón de micro (Chrome en Android) o el micro del teclado (iPhone).
- 🧠 **Entiende prioridad y fecha** de lo que dices: *"revisar curva horno 2 alta para el viernes"*.
- 📋 **Hoy**: vencidas → foco del día (vence hoy + prioridad alta) → próximos 7 días → resto.
- ✈️ Funciona **sin conexión**. Los datos se guardan **solo en el móvil** (localStorage).
- 🔔 **Aviso diario** (menú `···` → *Activar aviso diario*): resumen en una notificación una vez al día entre 7:00 y 21:00. Solo en Chrome de Android con la app instalada; Android decide la hora exacta.
- 💾 Copia de seguridad: exportar/importar JSON desde el menú `···`.

## Cómo dictar

| Dices | Resultado |
|---|---|
| `alta`, `media`, `baja`, `prioridad alta`, `urgente`, `importante`, `sin prisa` | Prioridad (por defecto: media) |
| `hoy`, `mañana`, `pasado mañana`, `el viernes`, `la semana que viene` | Fecha |
| `el 20/11`, `el 15 de diciembre`, `el día 5`, `en 3 días`, `fin de mes` | Fecha |
| `nota: …` | Todo lo que sigue va a notas |

"Dar de alta proveedor" no se toma como prioridad: la palabra solo cuenta al final de la frase, antes de la fecha o tras "prioridad".

## Instalar en el móvil

1. Abre `https://alejandro130196.github.io/mis-tareas/`.
2. **Android (Chrome)**: menú ⋮ → *Instalar aplicación*.
   **iPhone (Safari)**: botón compartir → *Añadir a pantalla de inicio*.

## Publicar en GitHub Pages

Repo → **Settings → Pages** → *Source: Deploy from a branch* → rama `main`, carpeta `/ (root)` → Save. En 1–2 min estará en la URL de arriba.

## Desarrollo

Sin dependencias ni compilación: HTML + CSS + JS.

```bash
python3 -m http.server 8000   # y abre http://localhost:8000
```

Al cambiar archivos, sube `VERSION` en `sw.js` para que los móviles instalados se actualicen.

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura |
| `styles.css` | Estilos (modo claro/oscuro) |
| `app.js` | Lógica, vistas, voz, copia de seguridad |
| `parse.js` | Interpreta la frase: prioridad, fecha, notas |
| `sw.js` | Caché sin conexión |
| `manifest.webmanifest` | Datos para instalarla como app |
