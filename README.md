# 🎵 Música para la Boda · M & A

Sitio web para que los invitados recopilen las canciones de la boda. Cada quien
pega el enlace de una canción (YouTube, Spotify, Apple Music…), deja su nombre, y
el sistema arma la lista. Incluye **validación de duplicados** y una **bitácora**
de quién agregó cada canción y quién intentó subir una repetida.

No usa login: solo pide el nombre.

---

## ✨ Características

- **Pegar enlace y listo**: el sistema detecta solo el nombre de la canción
  (YouTube y Spotify) si no lo escribes.
- **Sin duplicados**: reconoce la misma canción aunque el enlace traiga parámetros
  distintos (ej. `youtu.be/ID?si=...` = `youtube.com/watch?v=ID`).
- **Bitácora privada**: registra cada canción agregada y cada intento de subir una
  repetida (con nombre y fecha). Solo tú la ves, protegida con una contraseña.
- **Compartido**: todos los invitados ven la misma lista.
- **Diseño**: paleta blanco · verde salvia · dorado bronce, con logo monograma M & A.
- **Sin dependencias**: corre solo con Node.js, no necesita `npm install`.

---

## ▶️ Cómo usarlo en tu computadora

1. Tener instalado **Node.js** (ya lo tienes: v16+).
2. Abrir una terminal en esta carpeta y ejecutar:

   ```
   npm start
   ```
   (o directamente `node server.js`)

3. Abrir en el navegador: **http://localhost:3000**

Para que otros en tu **misma red WiFi** entren desde su teléfono, comparte tu IP
local (ej. `http://192.168.1.50:3000`). Para verla:
`ipconfig` en la terminal → busca "Dirección IPv4".

---

## 🔒 Bitácora privada (solo para ti)

La bitácora **no la ven los invitados**. Para verla:

1. En el pie de página hay un enlace discreto: **"Bitácora privada"**
   (o entra directo a `http://localhost:3000/bitacora.html`).
2. Escribe la contraseña. Por defecto es:

   ```
   boda-ma-2026
   ```

3. **Cámbiala** por una tuya: abre `server.js` y edita esta línea (arriba del todo):

   ```js
   const ADMIN_KEY = process.env.ADMIN_KEY || 'boda-ma-2026';
   ```

   Reemplaza `'boda-ma-2026'` por la clave que quieras. Reinicia el servidor.

---

## 📸 Fotos de los novios

Coloca 3 fotos en la carpeta `public/images/` con estos nombres exactos:

- `novios-1.jpg` — foto vertical grande
- `novios-2.jpg` — foto cuadrada/vertical
- `novios-3.jpg` — foto del anillo

Si no las pones, el sitio muestra un recuadro con 🤍 y sigue funcionando.
Ver `public/images/LEEME.txt` para más detalles.

---

## 🌐 Cómo subirlo a internet (gratis)

Para que los invitados entren desde cualquier lugar (no solo tu WiFi), sube el
proyecto a un hosting gratuito como **Render**:

1. Crea una cuenta en https://render.com
2. Sube esta carpeta a un repositorio de GitHub.
3. En Render: **New → Web Service**, conecta el repo.
4. Configura:
   - **Build Command**: (déjalo vacío)
   - **Start Command**: `node server.js`
5. Render te da una URL pública (ej. `https://boda-ma.onrender.com`). ¡Compártela!

> Nota: en hosting con almacenamiento efímero, el archivo `data/` puede reiniciarse
> en cada redeploy. Para una boda real conviene descargar la lista final con
> tiempo, o usar un disco persistente (Render lo ofrece). Si quieres, te ayudo a
> conectarlo a una base de datos gratuita más adelante.

---

## 📂 Estructura

```
MusicaBodaM&A/
├── server.js          # Servidor (Node nativo, sin dependencias)
├── package.json
├── data/              # Datos guardados (se crean solos)
│   ├── songs.json     # Lista de canciones
│   └── log.json       # Bitácora
└── public/            # Sitio web
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── logo.svg       # Logo monograma M & A
    └── images/        # ← aquí van las fotos de los novios
```

---

## 💾 Ver / respaldar los datos

- La lista de canciones está en `data/songs.json`.
- La bitácora está en `data/log.json`.

Ambos son archivos de texto que puedes abrir, respaldar o imprimir cuando quieras.
