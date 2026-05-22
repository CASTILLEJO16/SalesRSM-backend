const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../utils/roles');

// Obtener todos los productos (todos los usuarios autenticados)
router.get('/', auth, async (req, res) => {
  try {
    const { activo } = req.query;
    const filter = activo !== undefined ? { activo: activo === 'true' } : {};
    
    const products = await Product.find(filter).sort({ nombre: 1 });
    return res.json(products);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error al obtener productos' });
  }
});

// Obtener un producto por ID
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Producto no encontrado' });
    return res.json(product);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error al obtener producto' });
  }
});

// Crear nuevo producto (solo admin y gerente)
router.post('/', auth, authorize([ROLES.admin, ROLES.gerente]), async (req, res) => {
  const { nombre, descripcion, precio, stock, unidad, categoria } = req.body;
  
  if (!nombre) {
    return res.status(400).json({ msg: 'El nombre del producto es requerido' });
  }
  
  if (precio === undefined || precio === null) {
    return res.status(400).json({ msg: 'El precio es requerido' });
  }
  
  if (stock === undefined || stock === null) {
    return res.status(400).json({ msg: 'El stock es requerido' });
  }

  try {
    // Verificar si ya existe un producto con el mismo nombre
    const existingProduct = await Product.findOne({ nombre: nombre.trim() });
    if (existingProduct) {
      return res.status(400).json({ msg: 'Ya existe un producto con ese nombre' });
    }

    const product = new Product({
      nombre: nombre.trim(),
      descripcion: descripcion || '',
      precio: Number(precio),
      stock: Number(stock),
      unidad: unidad || 'unidad',
      categoria: categoria || 'General'
    });

    await product.save();
    return res.status(201).json(product);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error al crear producto' });
  }
});

// Actualizar producto (solo admin y gerente)
router.put('/:id', auth, authorize([ROLES.admin, ROLES.gerente]), async (req, res) => {
  const { nombre, descripcion, precio, stock, unidad, categoria, activo } = req.body;

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Producto no encontrado' });

    // Si se cambia el nombre, verificar que no exista otro producto con ese nombre
    if (nombre && nombre.trim() !== product.nombre) {
      const existingProduct = await Product.findOne({ 
        nombre: nombre.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingProduct) {
        return res.status(400).json({ msg: 'Ya existe un producto con ese nombre' });
      }
    }

    const updates = {};
    if (nombre !== undefined) updates.nombre = nombre.trim();
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (precio !== undefined) updates.precio = Number(precio);
    if (stock !== undefined) updates.stock = Number(stock);
    if (unidad !== undefined) updates.unidad = unidad;
    if (categoria !== undefined) updates.categoria = categoria;
    if (activo !== undefined) updates.activo = activo;

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    return res.json(updatedProduct);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error al actualizar producto' });
  }
});

// Eliminar producto (solo admin)
router.delete('/:id', auth, authorize([ROLES.admin]), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Producto no encontrado' });

    await Product.findByIdAndDelete(req.params.id);
    return res.json({ msg: 'Producto eliminado correctamente' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error al eliminar producto' });
  }
});

// Actualizar stock (para cuando se realizan ventas)
router.patch('/:id/stock', auth, async (req, res) => {
  const { cantidad } = req.body;
  
  if (cantidad === undefined || cantidad === null) {
    return res.status(400).json({ msg: 'La cantidad es requerida' });
  }

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Producto no encontrado' });

    const nuevoStock = product.stock + Number(cantidad);
    
    if (nuevoStock < 0) {
      return res.status(400).json({ msg: 'Stock insuficiente' });
    }

    product.stock = nuevoStock;
    await product.save();

    return res.json(product);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error al actualizar stock' });
  }
});

module.exports = router;
