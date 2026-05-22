const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  nombre: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  precio: {
    type: Number,
    required: true,
    default: 0
  },
  stock: {
    type: Number,
    required: true,
    default: 0
  },
  unidad: {
    type: String,
    enum: ['unidad', 'kg', 'g', 'lb', 'caja', 'litro', 'ml', 'metro', 'cm', 'paca', 'bulto'],
    default: 'unidad'
  },
  categoria: {
    type: String,
    default: 'General'
  },
  activo: {
    type: Boolean,
    default: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: {
    type: Date,
    default: Date.now
  }
});

// Actualizar fechaActualización antes de guardar
productSchema.pre('save', function(next) {
  this.fechaActualizacion = new Date();
  next();
});

module.exports = mongoose.model('Product', productSchema);
