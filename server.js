require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// ⚠️ CORS DEBE IR PRIMERO - ANTES DE TODO
app.use(cors({
  origin: function(origin, callback) {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://192.168.1.102:5173',
      'http://localhost:5174',
      'https://frontendrsm.vercel.app',
      'https://frontendrsm-castillejo16s-projects.vercel.app'
    ];
    
    // Permitir cualquier subdominio de vercel.app
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Por ahora permitir todos para debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600
}));

// Manejar preflight requests explícitamente
app.options('*', cors());

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);

// Estado de conexión a MongoDB
let mongoConnected = false;

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: '✅ API SalesRSM funcionando correctamente',
    status: 'online',
    database: mongoConnected ? 'connected' : 'connecting...'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: mongoConnected ? 'healthy' : 'degraded',
    database: mongoConnected ? 'connected' : 'connecting...',
    uptime: process.uptime()
  });
});

// Puerto
const PORT = process.env.PORT || 4000;

// Primero arrancar el servidor HTTP (no depender de MongoDB)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

// Luego conectar a MongoDB en paralelo
const connectMongo = () => {
  console.log('🔄 Conectando a MongoDB...');
  mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  })
    .then(() => {
      mongoConnected = true;
      console.log('✅ MongoDB conectado exitosamente');
    })
    .catch(err => {
      console.error('❌ Error conectando a MongoDB:', err.message);
      console.log('🔄 Reintentando en 5 segundos...');
      setTimeout(connectMongo, 5000);
    });
};

connectMongo();