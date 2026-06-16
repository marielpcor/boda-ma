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

## 🌐 Cómo subirlo a internet (gratis y confiable)

Usamos **Supabase** (base de datos gratis, donde se guardan las canciones para
siempre) + **Render** (donde corre la app, gratis). Pasos:

### 1) Supabase — base de datos
1. Crea una cuenta en https://supabase.com (botón "Start your project").
2. Crea un proyecto nuevo (elige una contraseña para la base de datos y guárdala).
3. En el menú lateral: **SQL Editor → New query**. Pega TODO el contenido del
   archivo [`supabase-schema.sql`](supabase-schema.sql) y presiona **Run**.
4. Ve a **Project Settings → API** y copia dos cosas:
   - **Project URL** (ej. `https://xxxx.supabase.co`)
   - La clave secreta **`service_role`** (en "Project API keys"). ⚠️ Es secreta.

### 2) GitHub — guardar el código
1. Crea una cuenta en https://github.com (si no tienes).
2. Crea un repositorio nuevo y **vacío** (sin README), por ejemplo `boda-ma`.
3. Copia la URL del repo (ej. `https://github.com/tuusuario/boda-ma.git`).
   (Pídele a tu asistente que haga el `git push`, o sigue las instrucciones que
   GitHub muestra para "push an existing repository".)

### 3) Render — publicar la app
1. Crea una cuenta en https://render.com (puedes entrar con GitHub).
2. **New → Web Service** y conecta tu repositorio `boda-ma`.
3. Configura:
   - **Build Command**: (déjalo vacío)
   - **Start Command**: `node server.js`
4. En **Environment → Add Environment Variable**, agrega TRES variables:
   - `SUPABASE_URL` = la Project URL de Supabase
   - `SUPABASE_KEY` = la clave `service_role`
   - `ADMIN_KEY` = la contraseña que quieras para la bitácora
5. **Create Web Service**. Render te dará una URL pública
   (ej. `https://boda-ma.onrender.com`). ¡Esa es la que compartes con los invitados!

> Las canciones se guardan en Supabase, así que **nunca se pierden** aunque Render
> reinicie o "duerma" el servidor.

---

## 📂 Estructura

```
MusicaBodaM&A/
├── server.js            # Servidor (Node nativo, sin dependencias)
├── storage.js           # Almacenamiento: archivos locales o Supabase
├── supabase-schema.sql  # SQL para crear las tablas en Supabase
├── .env.example         # Plantilla de variables de entorno
├── package.json
├── data/                # Datos LOCALES (se crean solos; en la nube se usa Supabase)
│   ├── songs.json
│   └── log.json
└── public/              # Sitio web
    ├── index.html
    ├── bitacora.html    # Bitácora privada (con contraseña)
    ├── styles.css
    ├── app.js
    ├── bitacora.js
    ├── logo.svg         # Logo monograma M & A
    └── images/          # ← aquí van las fotos de los novios
```

---

## 💾 Ver / respaldar los datos

- La lista de canciones está en `data/songs.json`.
- La bitácora está en `data/log.json`.

Ambos son archivos de texto que puedes abrir, respaldar o imprimir cuando quieras.
