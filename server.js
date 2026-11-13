require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(express.json());
app.use(cors({
  origin: [
    'https://abd-ship.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'null'
  ]
}));

const PORT = process.env.PORT || 3000;
const client = new MongoClient(process.env.MONGODB_URI);
let solicitudes;

const ESTADOS = ['nueva', 'en proceso', 'cerrada'];
const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

// ----- Sesión de admin: token firmado con HMAC y caducidad -----
function crearToken() {
  const exp = Date.now() + DURACION_SESION_MS;
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const firma = crypto.createHmac('sha256', process.env.ADMIN_PASSWORD).update(payload).digest('base64url');
  return payload + '.' + firma;
}

function tokenValido(token) {
  if (!token || !process.env.ADMIN_PASSWORD) return false;
  const [payload, firma] = token.split('.');
  if (!payload || !firma) return false;
  const esperada = crypto.createHmac('sha256', process.env.ADMIN_PASSWORD).update(payload).digest('base64url');
  const correcta = Buffer.from(esperada);
  const recibida = Buffer.from(firma);
  if (correcta.length !== recibida.length || !crypto.timingSafeEqual(correcta, recibida)) return false;
  const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return Date.now() < exp;
}

function requiereAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!tokenValido(token)) {
    return res.status(401).json({ error: 'Sesión no válida' });
  }
  next();
}

// ----- Rutas públicas -----
app.get('/', (req, res) => {
  res.json({ servicio: 'Marín Digital backend', estado: 'activo' });
});

app.post('/api/solicitudes', async (req, res) => {
  try {
    const { nombre, correo, telefono, servicio, mensaje } = req.body || {};
    if (!nombre || !correo || !telefono || !servicio) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }
    await solicitudes.insertOne({
      nombre,
      correo,
      telefono,
      servicio,
      mensaje: mensaje || '',
      estado: 'nueva',
      creada: new Date()
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Error al guardar la solicitud:', error.message);
    res.status(500).json({ error: 'No se pudo guardar la solicitud' });
  }
});

// ----- Recomendación con IA (Google Gemini) -----
const CATALOGO = `
Páginas web (pago único):
- Básica: $1.200.000 COP. 1 página, formulario y diseño responsive. Entrega en 5 días.
- Estándar: $2.200.000 COP. Hasta 4 secciones, catálogo y Google Maps. Entrega en 8 días.
- Premium: $3.800.000 COP. Sitio completo con panel admin y chatbot. Entrega en 15 días.

Calistenia y street workout (al mes):
- Principiante: $180.000 COP. Evaluación inicial, plan de fuerza base y ajustes cada 2 semanas.
- Intermedio: $260.000 COP. Progresiones hacia nuevas habilidades y seguimiento semanal.
- Avanzado: $350.000 COP. Habilidades avanzadas, ajustes frecuentes y revisión de técnica.

Marketing digital (al mes):
- Básico: $450.000 COP. Diagnóstico de redes y sitio, y campañas básicas.
- Estándar: $900.000 COP. Estrategia de contenido, calendario mensual y campañas en redes.
- Premium: $1.500.000 COP. Estrategia completa en varias redes y medición mensual.

Descuento: 10% si la persona contrata dos o más servicios como un solo paquete.
`;

const PAQUETES_VALIDOS = {
  'Páginas web': ['Básica', 'Estándar', 'Premium'],
  'Calistenia y street workout': ['Principiante', 'Intermedio', 'Avanzado'],
  'Marketing digital': ['Básico', 'Estándar', 'Premium']
};

app.post('/api/recomendacion', async (req, res) => {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) {
    return res.status(503).json({ error: 'IA no configurada' });
  }
  try {
    const datos = req.body || {};
    const instruccion = `Eres el asesor de Marín Digital, un negocio que ofrece páginas web, asesoría de calistenia y street workout, y marketing digital.
Recomienda solo paquetes de este catálogo. No inventes precios, planes ni servicios.
${CATALOGO}
Datos de la persona: ${JSON.stringify(datos)}

Responde únicamente con JSON, con esta forma exacta:
{"recomendaciones":[{"servicio":"Páginas web | Calistenia y street workout | Marketing digital","paquete":"nombre exacto del paquete","motivo":"una frase corta"}],"mensaje":"2 o 3 frases cercanas y claras, en español, dirigidas a la persona"}
Incluye solo los servicios que la persona eligió.`;

    // Prueba varios modelos, en orden, hasta que uno responda
    const modelos = [...new Set([process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'].filter(Boolean))];
    let texto = null;
    let ultimoError = '';

    for (const modelo of modelos) {
      const respuesta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${clave}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: instruccion }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
          })
        }
      );
      if (respuesta.ok) {
        const data = await respuesta.json();
        texto = data.candidates[0].content.parts[0].text;
        break;
      }
      const cuerpo = await respuesta.text();
      ultimoError = `modelo ${modelo}: ${respuesta.status} ${cuerpo.slice(0, 300)}`;
      console.error('Gemini no respondió:', ultimoError);
    }

    if (!texto) {
      throw new Error(ultimoError || 'ningún modelo respondió');
    }

    const resultado = JSON.parse(texto);

    // Solo se aceptan servicios y paquetes del catálogo real
    const recomendaciones = (resultado.recomendaciones || []).filter((r) =>
      PAQUETES_VALIDOS[r.servicio] && PAQUETES_VALIDOS[r.servicio].includes(r.paquete)
    );
    if (recomendaciones.length === 0 || typeof resultado.mensaje !== 'string') {
      throw new Error('Respuesta de la IA fuera del catálogo');
    }

    res.json({
      mensaje: resultado.mensaje.slice(0, 600),
      recomendaciones: recomendaciones.map((r) => ({
        servicio: r.servicio,
        paquete: r.paquete,
        motivo: String(r.motivo || '').slice(0, 200)
      }))
    });
  } catch (error) {
    console.error('Error en la recomendación con IA:', error.message);
    res.status(502).json({ error: 'No pudimos generar la recomendación' });
  }
});

// ----- Rutas del panel admin -----
app.post('/api/admin/login', (req, res) => {
  const { usuario, clave } = req.body || {};
  const usuarioOk = usuario === process.env.ADMIN_USER;
  const claveOk = clave === process.env.ADMIN_PASSWORD;
  if (!usuarioOk || !claveOk || !process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  res.json({ token: crearToken() });
});

app.get('/api/admin/solicitudes', requiereAdmin, async (req, res) => {
  try {
    const lista = await solicitudes.find({}).sort({ creada: -1 }).toArray();
    res.json(lista);
  } catch (error) {
    console.error('Error al listar solicitudes:', error.message);
    res.status(500).json({ error: 'No se pudieron cargar las solicitudes' });
  }
});

app.patch('/api/admin/solicitudes/:id', requiereAdmin, async (req, res) => {
  try {
    const { estado } = req.body || {};
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    await solicitudes.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { estado } }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Error al actualizar estado:', error.message);
    res.status(500).json({ error: 'No se pudo actualizar el estado' });
  }
});

async function iniciar() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Falta MONGODB_URI en las variables de entorno');
  }
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) {
    console.warn('Aviso: faltan ADMIN_USER o ADMIN_PASSWORD; el login del panel no funcionará');
  }
  await client.connect();
  solicitudes = client.db('marin').collection('solicitudes');
  app.listen(PORT, () => console.log('Servidor listo en puerto ' + PORT));
}

iniciar().catch((error) => {
  console.error('No se pudo iniciar:', error.message);
  process.exit(1);
});
