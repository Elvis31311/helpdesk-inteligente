// ============================================================
// HELP DESK INTELIGENTE — Backend API (el "cerebro")
// Node.js + Express, desplegado en Vercel como función serverless
// ============================================================

// Carga variables de entorno desde .env SOLO en desarrollo local.
// En Vercel las variables se configuran en el dashboard y ya están disponibles.
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch (e) { /* dotenv es opcional */ }
}

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------------
// 1) CONEXIÓN A MONGODB ATLAS (con cache para entornos serverless)
// ------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'helpdesk';

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  if (!MONGODB_URI) {
    throw new Error('Falta configurar la variable de entorno MONGODB_URI');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}

// ------------------------------------------------------------
// 2) AGENTE DE IA (Google Gemini) — el "recepcionista inteligente"
// ------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// gemini-3.1-flash-lite es el modelo gratuito vigente de Google (Gemini 3, GA desde mayo 2026).
// Si quieres más calidad de razonamiento (con el mismo tier gratuito), puedes usar "gemini-3.5-flash".
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

// La prioridad y todo lo demás ahora lo decide 100% la IA — el usuario ya no la elige.
async function clasificarConGemini(titulo, descripcion) {
  // Si no hay API key configurada, usamos una clasificación básica de respaldo
  // para que el sistema nunca se caiga por falta de IA.
  if (!GEMINI_API_KEY) {
    return {
      prioridad: 'media',
      categoria: 'general',
      equipo: 'level1',
      escalar: false,
      esPreguntaFrecuente: false,
      respuestaSugerida: null,
    };
  }

  const systemInstruction = `Eres el agente de IA de un Help Desk. Tu trabajo es leer un ticket de soporte, clasificarlo con criterio profesional y, siempre que puedas, dar una recomendación útil.

Reglas de clasificación:
- "prioridad": una de "critica", "alta", "media", "baja". Tú decides la prioridad real del problema; el usuario no la indica.
- "categoria": una de "hardware", "software", "red", "acceso", "infraestructura".
- "equipo": una de "level1", "level2", "devops", "infraestructura".
- "escalar": true si la prioridad es "critica" o "alta".
- "esPreguntaFrecuente": true SOLO si el ticket se puede resolver por completo con la respuesta de la IA, sin que un agente humano tenga que intervenir (ej. "¿cómo reinicio la VPN?", "olvidé mi contraseña", "no encuentro tal opción del sistema").
- "respuestaSugerida": escribe SIEMPRE una respuesta corta, clara y en español con pasos numerados o recomendaciones de solución, cada vez que exista un procedimiento conocido o una buena práctica que pueda ayudar — incluso si el ticket igual necesita intervención humana (en ese caso, la respuesta son solo pasos preliminares o recomendaciones mientras un agente lo revisa). Usa null únicamente si de verdad no hay ninguna recomendación posible sin más información.

Responde ÚNICAMENTE con un objeto JSON válido (sin texto extra, sin markdown), con este formato exacto:
{"prioridad": "...", "categoria": "...", "equipo": "...", "escalar": true, "esPreguntaFrecuente": false, "respuestaSugerida": "..." }`;

  const userPrompt = `Título: ${titulo}\nDescripción: ${descripcion}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Error de Gemini:', response.status, errText);
    throw new Error(`Gemini respondió con estado ${response.status}`);
  }

  const data = await response.json();
  const textoRespuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textoRespuesta) {
    throw new Error('Gemini no devolvió contenido interpretable');
  }

  return JSON.parse(textoRespuesta);
}

// ------------------------------------------------------------
// 3) INTEGRACIÓN CON TRELLO — el "tablero de emergencias"
// ------------------------------------------------------------
const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

// Un tablero con una lista por nivel de prioridad, en vez de una sola lista de "urgentes".
// Si no defines TRELLO_LIST_CRITICA, las tarjetas críticas caen en la lista de "alta".
const TRELLO_LISTS = {
  baja: process.env.TRELLO_LIST_BAJA,
  media: process.env.TRELLO_LIST_MEDIA,
  alta: process.env.TRELLO_LIST_ALTA,
  critica: process.env.TRELLO_LIST_CRITICA || process.env.TRELLO_LIST_ALTA,
};

function trelloConfigurado() {
  return Boolean(TRELLO_KEY && TRELLO_TOKEN && (TRELLO_LISTS.baja || TRELLO_LISTS.media || TRELLO_LISTS.alta));
}

async function crearTarjetaTrello(ticket, clasificacion) {
  const prioridad = clasificacion.prioridad || 'media';
  const idList = TRELLO_LISTS[prioridad] || TRELLO_LISTS.media || TRELLO_LISTS.alta;

  if (!TRELLO_KEY || !TRELLO_TOKEN || !idList) {
    console.warn(`Trello no está configurado para la prioridad "${prioridad}"; se omite la creación de tarjeta.`);
    return null;
  }

  const params = new URLSearchParams({
    key: TRELLO_KEY,
    token: TRELLO_TOKEN,
    idList,
    name: `[${prioridad.toUpperCase()}] ${ticket.titulo}`,
    desc: `Descripción: ${ticket.descripcion}\nEmail: ${ticket.email}\nCategoría: ${clasificacion.categoria}\nEquipo asignado: ${clasificacion.equipo}\nTicket ID: ${ticket._id}`,
  });

  const response = await fetch(`https://api.trello.com/1/cards?${params.toString()}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Error de Trello:', response.status, errText);
    return null;
  }

  const card = await response.json();
  return card.shortUrl || card.url || null;
}

// ------------------------------------------------------------
// 3.5) AUTENTICACIÓN DE ADMINISTRADOR (solo contraseña)
// ------------------------------------------------------------
// Una única contraseña definida en variables de entorno. Nunca vive en el código
// del navegador: el servidor es quien la valida.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function adminProtegido() {
  // Si no se configura, el panel de admin queda sin protección
  // (útil mientras configuras el proyecto por primera vez).
  return Boolean(ADMIN_PASSWORD);
}

function requiereAdmin(req, res, next) {
  if (!adminProtegido()) return next(); // sin variable configurada = sin candado (modo inicial)
  const token = req.headers['x-admin-token'];
  if (token && token === ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: 'No autorizado. Inicia sesión como administrador.' });
}

// ------------------------------------------------------------
// 4) RUTAS DE LA API
// ------------------------------------------------------------

// Login de administrador — solo contraseña
app.post('/api/admin/login', (req, res) => {
  if (!adminProtegido()) {
    return res.status(500).json({ error: 'El panel de admin todavía no tiene configurada la variable ADMIN_PASSWORD.' });
  }
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Contraseña incorrecta.' });
});

// Health check — útil para verificar que el despliegue funciona
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    gemini: Boolean(GEMINI_API_KEY),
    trello: trelloConfigurado(),
    mongo: Boolean(MONGODB_URI),
    adminProtegido: adminProtegido(),
  });
});

// Crear ticket (flujo completo: guarda -> clasifica con IA -> escala a Trello si aplica)
// El usuario YA NO elige prioridad: la decide 100% el agente de IA.
app.post('/api/tickets', async (req, res) => {
  try {
    const { titulo, descripcion, email } = req.body || {};

    if (!titulo || !descripcion || !email) {
      return res.status(400).json({ error: 'Título, descripción y email son obligatorios' });
    }

    const db = await connectToDatabase();

    const nuevoTicket = {
      titulo,
      descripcion,
      email,
      estado: 'abierto',
      categoria: null,
      equipo: null,
      prioridadIA: null,
      escalado: false,
      trelloUrl: null,
      respuestaIA: null,
      respuestaAdmin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const resultado = await db.collection('tickets').insertOne(nuevoTicket);
    const ticketId = resultado.insertedId;

    let mensaje = '¡Ticket creado! Nuestro agente de IA lo está revisando...';

    try {
      const clasificacion = await clasificarConGemini(titulo, descripcion);

      const actualizacion = {
        categoria: clasificacion.categoria,
        equipo: clasificacion.equipo,
        prioridadIA: clasificacion.prioridad,
        escalado: Boolean(clasificacion.escalar),
      };

      if (clasificacion.respuestaSugerida) {
        actualizacion.respuestaIA = clasificacion.respuestaSugerida;
      }

      if (clasificacion.esPreguntaFrecuente && clasificacion.respuestaSugerida) {
        // Preguntas frecuentes: la IA responde sola y el ticket se cierra.
        // No necesita tarjeta en Trello porque ya quedó resuelto.
        actualizacion.estado = 'cerrado';
        mensaje = 'Tu ticket ya fue respondido automáticamente por la IA.';
      } else {
        // Todo lo demás (baja, media, alta, crítica) obtiene una tarjeta
        // en la lista de Trello que corresponde a su prioridad, y sigue abierto
        // para que un agente lo confirme (aunque la IA ya haya dejado una recomendación).
        const trelloUrl = await crearTarjetaTrello({ ...nuevoTicket, _id: ticketId }, clasificacion);
        if (trelloUrl) {
          actualizacion.trelloUrl = trelloUrl;
        }
        mensaje = clasificacion.escalar
          ? 'Ticket creado. Es urgente: un agente lo revisará ahora mismo.'
          : 'Ticket creado y agregado a seguimiento. La IA dejó una recomendación mientras un agente lo confirma.';
      }

      await db.collection('tickets').updateOne(
        { _id: ticketId },
        { $set: { ...actualizacion, updatedAt: new Date() } }
      );
    } catch (iaError) {
      // Si falla la IA, el ticket ya quedó guardado; solo lo registramos.
      console.error('Aviso: no se pudo clasificar con IA:', iaError.message);
    }

    const ticketFinal = await db.collection('tickets').findOne({ _id: ticketId });
    res.status(201).json({ mensaje, ticket: ticketFinal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno al crear el ticket' });
  }
});

// Listar tickets. Si se pasa ?email=..., solo devuelve los de ese correo (portal de usuario, público).
// Sin ese parámetro, devuelve TODOS los tickets — eso requiere sesión de administrador.
app.get('/api/tickets', async (req, res, next) => {
  if (!req.query.email) return requiereAdmin(req, res, next);
  next();
}, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const filtro = {};
    if (req.query.email) {
      filtro.email = String(req.query.email).toLowerCase().trim();
    }
    const tickets = await db.collection('tickets').find(filtro).sort({ createdAt: -1 }).toArray();
    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los tickets' });
  }
});

// Ver un ticket específico
app.get('/api/tickets/:id', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const ticket = await db.collection('tickets').findOne({ _id: new ObjectId(req.params.id) });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(ticket);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'ID de ticket inválido' });
  }
});

// Actualizar ticket (ej. cerrar, reabrir, o el admin agrega su propia respuesta manual) — solo admin
app.put('/api/tickets/:id', requiereAdmin, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const cambios = { ...(req.body || {}), updatedAt: new Date() };
    delete cambios._id;

    const resultado = await db.collection('tickets').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: cambios },
      { returnDocument: 'after' }
    );

    const actualizado = resultado.value || resultado; // compatibilidad entre versiones del driver
    if (!actualizado) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(actualizado);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'No se pudo actualizar el ticket' });
  }
});

// Eliminar ticket — solo admin
app.delete('/api/tickets/:id', requiereAdmin, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const resultado = await db.collection('tickets').deleteOne({ _id: new ObjectId(req.params.id) });
    if (resultado.deletedCount === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json({ mensaje: 'Ticket eliminado' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'No se pudo eliminar el ticket' });
  }
});

// Endpoint manual del agente de IA (útil para probarlo solo, sin crear un ticket)
app.post('/api/agent/triage', async (req, res) => {
  try {
    const { titulo, descripcion } = req.body || {};
    if (!titulo || !descripcion) {
      return res.status(400).json({ error: 'Título y descripción son obligatorios' });
    }
    const clasificacion = await clasificarConGemini(titulo, descripcion);
    res.json(clasificacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al clasificar el ticket con IA' });
  }
});

// Estadísticas para el dashboard — solo admin
app.get('/api/stats', requiereAdmin, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const tickets = await db.collection('tickets').find().toArray();

    const stats = {
      total: tickets.length,
      abiertos: tickets.filter((t) => t.estado === 'abierto').length,
      cerrados: tickets.filter((t) => t.estado === 'cerrado').length,
      escalados: tickets.filter((t) => t.escalado).length,
      porPrioridad: {},
      porCategoria: {},
    };

    tickets.forEach((t) => {
      const p = t.prioridadIA || 'sin_clasificar';
      stats.porPrioridad[p] = (stats.porPrioridad[p] || 0) + 1;
      const c = t.categoria || 'sin_clasificar';
      stats.porCategoria[c] = (stats.porCategoria[c] || 0) + 1;
    });

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular estadísticas' });
  }
});

// ------------------------------------------------------------
// 5) EJECUCIÓN LOCAL vs. VERCEL
// ------------------------------------------------------------
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`✅ Servidor local corriendo en http://localhost:${PORT}`));
}

module.exports = app;
