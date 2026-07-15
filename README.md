# 🎫 IA Cenestur — Help Desk Inteligente con Agente de IA (100% Cloud, 100% Gratis)

Proyecto final de Cloud Computing — CENESTUR.

Ya está todo el código listo. Lo único que tienes que hacer es:
1. Crear 4 cuentas gratis (MongoDB, Google AI Studio, Trello, Vercel).
2. Copiar tus llaves a un archivo `.env`.
3. Subir el código a GitHub.
4. Conectar GitHub con Vercel.

Sigue los pasos en orden, no te saltes ninguno.

---

## 0. Lo que necesitas instalado en tu PC

- **Node.js** (versión 18 o más nueva) → https://nodejs.org
- **Git** → https://git-scm.com
- **VS Code** (o el editor que prefieras) → https://code.visualstudio.com
- Una cuenta de **GitHub** → https://github.com

Verifica que Node y Git estén instalados abriendo una terminal y escribiendo:
```
node -v
git -v
```

---

## 1. Crear la base de datos — MongoDB Atlas (gratis, 512 MB)

1. Ve a https://www.mongodb.com/cloud/atlas/register y crea una cuenta.
2. Crea un **Cluster gratuito** (M0 Free Tier). Elige cualquier proveedor/región cercana.
3. En **Database Access**, crea un usuario con contraseña (guárdala, la vas a necesitar).
4. En **Network Access**, agrega la IP `0.0.0.0/0` (permitir acceso desde cualquier lugar) — es necesario porque Vercel no tiene una IP fija.
5. Click en **Connect → Drivers**, copia la cadena de conexión. Se ve así:
   ```
   mongodb+srv://usuario:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Reemplaza `<password>` por tu contraseña real. Esto es tu `MONGODB_URI`.

---

## 2. Crear el agente de IA — Google AI Studio (Gemini, gratis)

1. Ve a https://aistudio.google.com/apikey
2. Inicia sesión con una cuenta de Google y click en **Create API key**.
3. Copia la key. Esto es tu `GEMINI_API_KEY`.
4. El modelo que usa este proyecto por defecto es `gemini-3.1-flash-lite` (el modelo gratuito vigente de Google, generación Gemini 3). Si en algún momento quieres mejor calidad de razonamiento sin salir del tier gratuito, cambia `GEMINI_MODEL` a `gemini-3.5-flash`.

> ⚠️ Google actualiza su catálogo de modelos con frecuencia y a veces retira modelos viejos para llaves nuevas (por ejemplo, `gemini-2.5-flash` dejó de estar disponible para keys nuevas). Si en el futuro te sale un error `404 NOT_FOUND` o "no longer available", solo necesitas cambiar el valor de `GEMINI_MODEL` en las variables de entorno de Vercel — no hace falta tocar código. Revisa el modelo vigente en https://ai.google.dev/gemini-api/docs/models

> 💡 Los límites gratuitos cambian de vez en cuando. Revisa el uso actual en el panel de AI Studio si te sale un error 429 (demasiadas peticiones).

---

## 3. Crear el tablero de emergencias — Trello (gratis)

1. Crea una cuenta en https://trello.com si no tienes.
2. Crea un **tablero nuevo** (ej. "Help Desk Inteligente") con **tres listas**: "Baja", "Media" y "Alta" (una por cada nivel de prioridad que clasifica la IA).
3. Obtener el **API Key**:
   - Ve a https://trello.com/power-ups/admin
   - Click en **New** para crear un Power-Up (dale cualquier nombre, ej. "HelpDeskApp"). Selecciona tu Workspace y click **Create**.
   - Dentro del Power-Up, ve a la pestaña **API Key** y click en **Generate a new API Key**.
   - Copia el **API Key**. Esto es tu `TRELLO_KEY`.
4. Obtener el **Token**:
   - En esa misma página, junto al API Key vas a ver un link llamado **Token**. Haz click.
   - Te va a pedir autorizar el acceso — dale **Allow**.
   - Copia el token que aparece (una cadena larga). Esto es tu `TRELLO_TOKEN`.
5. Obtener el **ID de cada lista**:
   - Abre tu tablero de Trello en el navegador.
   - Al final de la URL agrega `.json`, por ejemplo:
     `https://trello.com/b/AbCdEf12/help-desk-inteligente.json`
   - Busca (Ctrl+F) la palabra `"lists"` dentro del JSON que aparece. Vas a ver un array con tus 3 listas, cada una con su `"name"` y su `"id"`.
   - Copia el `"id"` de la lista "Baja" → `TRELLO_LIST_BAJA`, el de "Media" → `TRELLO_LIST_MEDIA`, y el de "Alta" → `TRELLO_LIST_ALTA`.
   - (Opcional) Si quieres una lista separada solo para tickets "críticos", crea una cuarta lista y guarda su ID como `TRELLO_LIST_CRITICA`. Si no la defines, los tickets críticos se van automáticamente a la lista de "Alta".

> Con esta configuración, **todos** los tickets (menos las preguntas frecuentes, que la IA responde y cierra sola) generan una tarjeta en la lista de Trello que corresponde a su prioridad — así el tablero funciona como un panorama completo de soporte, no solo de emergencias.

---

## 3.5. Proteger el panel de administrador con contraseña

El panel de admin (`admin.html`) pide una contraseña, verificada en el servidor (nunca queda escrita en el código del navegador).

1. Elige una contraseña para el panel de administrador.
2. Define esta variable de entorno (localmente en tu `.env`, y también en Vercel):
   ```
   ADMIN_PASSWORD=tu_contraseña_elegida
   ```

> ⚠️ Si dejas esta variable sin definir, el panel de admin queda **sin protección** (así funcionaba antes) — útil mientras configuras el proyecto por primera vez, pero recuerda configurarla antes de entregar o compartir la URL.

Con esto configurado, entrar a `admin.html` o `dashboard.html` directamente sin haber iniciado sesión en `admin-login.html` ya no muestra ningún dato: el servidor responde con error 401 a cualquier petición sin la contraseña correcta.

---

## 4. Configurar el proyecto en tu computadora

1. Descarga/descomprime este proyecto y ábrelo en VS Code.
2. Crea un archivo llamado `.env` en la raíz del proyecto (copia `.env.example` y renómbralo) y pega tus llaves:
   ```
   MONGODB_URI=mongodb+srv://usuario:tucontraseña@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=helpdesk
   GEMINI_API_KEY=tu_api_key_de_gemini
   GEMINI_MODEL=gemini-3.1-flash-lite
   TRELLO_KEY=tu_trello_key
   TRELLO_TOKEN=tu_trello_token
   TRELLO_LIST_BAJA=id_de_la_lista_baja
   TRELLO_LIST_MEDIA=id_de_la_lista_media
   TRELLO_LIST_ALTA=id_de_la_lista_alta
   ADMIN_PASSWORD=tu_contraseña_elegida
   ```
3. Instala las dependencias:
   ```
   npm install
   ```
4. Corre el servidor localmente:
   ```
   npm start
   ```
5. Abre en tu navegador:
   - http://localhost:3000/api/health → debe responder `{"status":"ok", ...}`
   - Abre el archivo `public/index.html` directamente en el navegador (o con la extensión "Live Server" de VS Code) para probar el formulario. *(Nota: si abres el HTML directo con doble clic, los fetch a `/api/...` no van a funcionar porque no hay servidor sirviendo esa página — usa Live Server, o simplemente prueba todo ya en Vercel en el paso 6, que es más sencillo)*.

---

## 5. Subir el proyecto a GitHub

1. Crea un repositorio nuevo (vacío) en https://github.com/new — por ejemplo `helpdesk-inteligente`.
2. En tu terminal, dentro de la carpeta del proyecto:
   ```
   git init
   git add .
   git commit -m "Proyecto Help Desk Inteligente"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/helpdesk-inteligente.git
   git push -u origin main
   ```
   > El archivo `.gitignore` ya está configurado para que **nunca** subas tu `.env` con tus llaves secretas a GitHub. Verifica que no aparezca en `git status`.

---

## 6. Desplegar en Vercel (gratis)

1. Ve a https://vercel.com y crea una cuenta usando **Continue with GitHub**.
2. Click en **Add New → Project**.
3. Selecciona el repositorio `helpdesk-inteligente` que acabas de subir.
4. Antes de dar click en Deploy, abre la sección **Environment Variables** y agrega, una por una, las mismas variables de tu `.env`:
   - `MONGODB_URI`
   - `DB_NAME`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`
   - `TRELLO_KEY`
   - `TRELLO_TOKEN`
   - `TRELLO_LIST_BAJA`
   - `TRELLO_LIST_MEDIA`
   - `TRELLO_LIST_ALTA`
   - `TRELLO_LIST_CRITICA` (opcional)
   - `ADMIN_PASSWORD`
5. Click en **Deploy**. Espera unos 30-60 segundos.
6. Cuando termine, Vercel te da una URL pública, algo como:
   ```
   https://helpdesk-inteligente.vercel.app
   ```

---

## 7. Probar todo en la nube

Abre en tu navegador (reemplaza con tu URL real):

- `https://tu-proyecto.vercel.app/login.html` → **punto de entrada del portal de usuario**. Escribe cualquier correo para "iniciar sesión" (es solo una identificación por correo, sin contraseña — así el sistema sabe qué tickets son tuyos).
- Después del login entras a `index.html` → aquí solo puedes **crear tickets** (con el botón "+ Nuevo ticket", que abre un popup) y **ver los tickets que tú mismo enviaste**, junto con la respuesta de la IA o del agente cuando llegue. La IA decide la prioridad sola; ya no la eliges tú.
- `https://tu-proyecto.vercel.app/admin.html` → **panel de agentes**. Ahora pide iniciar sesión primero en `admin-login.html` con la contraseña que definiste en `ADMIN_PASSWORD`. Aquí ves **todos** los tickets de todos los usuarios, con botón "Ver / Responder" para escribir una respuesta manual, verificar lo que dijo la IA, cerrar o eliminar el ticket.
- `https://tu-proyecto.vercel.app/dashboard.html` → estadísticas generales (enlazado desde el panel de agentes).
- `https://tu-proyecto.vercel.app/api/health` → debe decir `"mongo": true, "gemini": true, "trello": true`.

### Prueba los 3 escenarios del proyecto:
1. **Ticket normal**: título "Mi impresora no imprime" → la IA lo clasifica sola (ej. hardware/media), deja una recomendación, y aparece en tu lista de tickets aunque siga abierto para que el agente lo confirme.
2. **Ticket urgente**: título "SERVIDOR CAÍDO", descripción "Nadie puede entrar al sistema" → la IA lo marca como crítico/alto y se crea automáticamente una tarjeta en tu tablero de Trello.
3. **Pregunta frecuente**: título "¿Cómo reinicio la VPN?" → la IA detecta que se puede resolver sola, responde con pasos y cierra el ticket automáticamente — lo ves reflejado al instante en tu portal de usuario.

Cada vez que hagas `git push`, Vercel vuelve a desplegar automáticamente (CI/CD).

> ⚠️ **Nota sobre el login:** es una identificación simple por correo (sin contraseña), pensada para un proyecto académico. Cualquiera que escriba el mismo correo vería esos mismos tickets — no es una autenticación real con verificación de identidad. Si en algún momento quieres algo más robusto (código de verificación por correo, por ejemplo), dime y lo agregamos.

---

## 8. Cómo esto cubre las 4 fases de la rúbrica

| Fase | Dónde está en el proyecto |
|---|---|
| **IaaS** | MongoDB Atlas = infraestructura de base de datos como servicio. Arquitectura documentada abajo. |
| **PaaS** | Frontend y backend (Node.js/Express) desplegados en Vercel; CI/CD automático vía GitHub. |
| **SaaS** | Integración con Trello (gestión de incidencias) y GitHub (colaboración/versionado). |
| **Agente de IA** | Endpoint `/api/agent/triage` con Gemini: clasifica prioridad/categoría, detecta preguntas frecuentes y responde solo, y activa la creación de tarjetas en Trello cuando corresponde. |

### Arquitectura (resumen para tu informe técnico)
```
Usuario (navegador)
   → Frontend (Vercel / public/*.html)
      → Backend API (Vercel Serverless / api/index.js — Node + Express)
         → MongoDB Atlas (persistencia de tickets)
         → Google Gemini API (clasificación IA)
         → Trello API (tarjetas automáticas si el ticket es urgente)
```

---

## 9. Problemas comunes

- **"gemini": false en /api/health** → revisa que `GEMINI_API_KEY` esté bien copiada en las Environment Variables de Vercel (y que hayas hecho un nuevo deploy después de agregarla).
- **Error 429 de Gemini** → alcanzaste el límite gratuito por minuto/día. Espera un momento o cambia a `gemini-2.5-flash-lite`.
- **No se crea la tarjeta en Trello** → revisa que `TRELLO_LIST_BAJA` / `TRELLO_LIST_MEDIA` / `TRELLO_LIST_ALTA` sean IDs de listas que sí existan en un tablero al que tu token tenga acceso (y no IDs de tableros o de tarjetas, que se confunden fácilmente).
- **Error de conexión a MongoDB** → revisa que en Network Access hayas agregado `0.0.0.0/0`, y que la contraseña en `MONGODB_URI` no tenga caracteres especiales sin codificar (si tu contraseña tiene `@`, `#`, etc., reemplázalos por su código `%XX`, o mejor, genera una contraseña solo con letras y números).
- Después de cambiar cualquier variable de entorno en Vercel, tienes que hacer **Redeploy** para que tome efecto.

