require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

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

async function iniciar() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Falta MONGODB_URI en el archivo .env');
  }
  await client.connect();
  solicitudes = client.db('marin').collection('solicitudes');
  app.listen(PORT, () => console.log('Servidor listo en puerto ' + PORT));
}

iniciar().catch((error) => {
  console.error('No se pudo iniciar:', error.message);
  process.exit(1);
});
