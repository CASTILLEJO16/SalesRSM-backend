const mongoose = require('mongoose');

const VentaSchema = new mongoose.Schema({
  producto: { type: String, required: false },
  monto: { type: Number, required: true, default: 0 },
  fecha: { type: Date, default: Date.now }
});

const HistorialSchema = new mongoose.Schema({
  tipo: { type: String, required: true }, // e.g. 'creado','compra','mensaje','editado','eliminado'
  mensaje: { type: String, required: false },
  monto: { type: Number, required: false },
  producto: { type: String, required: false },
  fecha: { type: Date, default: Date.now },
   imagen: String,
  usuario: { // opcional: quién hizo la acción
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    nombre: { type: String, required: false }
  }
});

const ClientSchema = new mongoose.Schema({
  nombre: String,
  telefono: String,
  email: String,
  empresa: String,
  fecha: { type: Date, default: Date.now },
  compro: { type: Boolean, default: false },
  observaciones: String,
  razonNoCompra: String,
  contactosAdicionales: [{ nombre: String, telefono: String }],
  vendedor: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nombre: String,
    username: String
  },
  ventas: { type: [VentaSchema], default: [] },
  historial: { type: [HistorialSchema], default: [] }
});

module.exports = mongoose.model("Client", ClientSchema);
