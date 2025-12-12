require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Configurar CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://tu-dominio.vercel.app' // Lo actualizarás después del deploy
  ],
  credentials: true
}));

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: '✅ API SalesRSM funcionando correctamente',
    status: 'online'
  });
});

// Puerto
const PORT = process.env.PORT || 4000;

// Conexión a MongoDB y arranque del servidor
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB conectado exitosamente');
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err);
    process.exit(1);
  });