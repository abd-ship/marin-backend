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
