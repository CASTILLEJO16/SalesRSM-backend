const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const User = require('../models/User');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../utils/roles');

function canAccessClient(client, user) {
  const role = user?.role || ROLES.vendedor;
  if (role === ROLES.admin || role === ROLES.gerente) return true;
  return String(client?.vendedor?.id || '') === String(user?.id || '');
}

// ============================================================
// RUTAS PÚBLICAS (sin auth) - DEBEN IR PRIMERO
// ============================================================

// Obtener cliente por ID (público - para QR)
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);
    
    if (!client) {
      return res.status(404).json({ msg: "Cliente no encontrado" });
    }
    
    // Devolver solo información básica
    res.json({
      _id: client._id,
      nombre: client.nombre,
      telefono: client.telefono,
      email: client.email,
      empresa: client.empresa
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Error obteniendo cliente" });
  }
});

// Enviar mensaje público (sin auth - para QR)
router.post('/public/:id/mensaje', async (req, res) => {
  try {
    const { id } = req.params;
    const { mensaje, imagen } = req.body;

    if (!mensaje || mensaje.trim() === "") {
      return res.status(400).json({ msg: "Mensaje vacío" });
    }

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ msg: "Cliente no encontrado" });

    // Validar tamaño de imagen (máximo 5MB en base64)
    if (imagen && imagen.length > 7000000) {
      return res.status(400).json({ msg: "Imagen muy grande (máximo 5MB)" });
    }

    client.observaciones = mensaje;

    client.historial.push({
      tipo: 'mensaje',
      mensaje,
      imagen: imagen || null,
      fecha: new Date(),
      usuario: { nombre: 'Mensaje vía QR' } // Identificador para mensajes desde QR
    });

    await client.save();
    res.json({ msg: "Mensaje guardado correctamente" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Error guardando mensaje" });
  }
});

// ============================================================
// RUTAS PROTEGIDAS (requieren auth)
// ============================================================

// Create client (registra historial)
router.post('/', auth, async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      email,
      empresa,
      fecha,
      compro,
      observaciones,
      razonNoCompra,
      monto,
      producto
    } = req.body;

    const ventasIniciales = [];
    if (monto && Number(monto) > 0) {
      ventasIniciales.push({
        producto: producto || "Compra inicial",
        monto: Number(monto),
        fecha: new Date()
      });
    }

    // 🔧 FIX DEFINITIVO: Forzar fecha local sin UTC
    let fechaCliente;
    if (fecha) {
      const [year, month, day] = fecha.split('-').map(Number);
      fechaCliente = new Date(year, month - 1, day, 12, 0, 0);
    } else {
      const ahora = new Date();
      fechaCliente = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 12, 0, 0);
    }

    const role = req.user.role || ROLES.vendedor;
    let vendedor = {
      id: req.user.id,
      nombre: req.user.nombre,
      username: req.user.username
    };

    // Admin/Gerente pueden asignar cliente a otro vendedor
    if ((role === ROLES.admin || role === ROLES.gerente) && req.body.vendedorId) {
      const assigned = await User.findById(req.body.vendedorId);
      if (assigned) {
        vendedor = {
          id: assigned._id,
          nombre: assigned.nombre,
          username: assigned.username
        };
      }
    }

    const client = new Client({
      nombre,
      telefono,
      email,
      empresa,
      fecha: fechaCliente,
      compro,
      observaciones,
      razonNoCompra,
      ventas: ventasIniciales,
      vendedor
    });

    // historial: creación
    client.historial.push({
      tipo: 'creado',
      mensaje: `Cliente creado por ${req.user.nombre || req.user.username || 'sistema'}`,
      fecha: new Date(),
      usuario: { id: req.user.id, nombre: req.user.nombre || req.user.username }
    });

    // historial: compra inicial (si existe)
    if (ventasIniciales.length > 0) {
      client.historial.push({
        tipo: 'compra',
        mensaje: `Compra inicial: ${ventasIniciales[0].producto}`,
        monto: ventasIniciales[0].monto,
        producto: ventasIniciales[0].producto,
        fecha: new Date(),
        usuario: { id: req.user.id, nombre: req.user.nombre || req.user.username }
      });
    }

    await client.save();
    res.json(client);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Error creando cliente" });
  }
});

// Get all clients
router.get('/', auth, async (req, res) => {
  try {
    const role = req.user.role || ROLES.vendedor;
    const query = role === ROLES.vendedor ? { 'vendedor.id': req.user.id } : {};
    const clients = await Client.find(query).sort({ fecha: -1 });
    res.json(clients);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Error obteniendo clientes" });
  }
});

/* ============================================================
   PUT - Actualizar cliente (GUARDA HISTORIAL DETALLADO)
============================================================ */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ msg: "Cliente no encontrado" });
    if (!canAccessClient(client, req.user)) return res.status(403).json({ msg: "No autorizado" });

    if (!canAccessClient(client, req.user)) {
      return res.status(403).json({ msg: "No autorizado" });
    }

    const cambios = [];
    const usuarioHistorial = { id: req.user.id, nombre: req.user.nombre || req.user.username };
    
    // 1️⃣ Detectar cambios en campos básicos
    const camposImportantes = {
      nombre: 'Nombre',
      telefono: 'Teléfono', 
      email: 'Email',
      empresa: 'Empresa',
      compro: 'Estado de compra',
      razonNoCompra: 'Razón de no compra'
    };
    
    for (const [campo, etiqueta] of Object.entries(camposImportantes)) {
      if (req.body[campo] !== undefined && 
          String(req.body[campo]) !== String(client[campo])) {
        cambios.push({
          tipo: "editado",
          mensaje: `${etiqueta} modificado`,
          fecha: new Date(),
          usuario: usuarioHistorial
        });
      }
    }

    // 2️⃣ Detectar cambio en observaciones
    if (req.body.observaciones !== undefined && 
        req.body.observaciones !== client.observaciones) {
      cambios.push({
        tipo: "mensaje",
        mensaje: req.body.observaciones,
        fecha: new Date(),
        usuario: usuarioHistorial
      });
    }

    // 3️⃣ Detectar NUEVAS VENTAS (array ventas creció)
    const ventasAnteriores = client.ventas?.length || 0;
    const ventasNuevas = req.body.ventas?.length || 0;
    const appendedSales = ventasNuevas > ventasAnteriores;
    
    if (appendedSales) {
      // Agregar historial por cada venta nueva
      const nuevasVentasArray = req.body.ventas.slice(ventasAnteriores);
      
      nuevasVentasArray.forEach(venta => {
        cambios.push({
          tipo: "compra",
          mensaje: `Venta registrada: ${venta.producto || 'Producto'}`,
          monto: venta.monto,
          fecha: new Date(),
          usuario: usuarioHistorial
        });

        const montoNum = Number(venta?.monto || 0);
        if (montoNum > 0) {
          client.ventas.push({
            producto: venta.producto || 'Venta',
            monto: montoNum,
            fecha: venta.fecha ? new Date(venta.fecha) : new Date()
          });
          client.compro = true;
        }
      });
    }

    // 4️⃣ Detectar cambios en contactos adicionales
    if (req.body.contactosAdicionales && 
        JSON.stringify(req.body.contactosAdicionales) !== JSON.stringify(client.contactosAdicionales)) {
      cambios.push({
        tipo: "editado",
        mensaje: "Contactos adicionales actualizados",
        fecha: new Date(),
        usuario: usuarioHistorial
      });
    }

    // Admin/Gerente: permitir reasignar vendedor
    const role = req.user.role || ROLES.vendedor;
    if ((role === ROLES.admin || role === ROLES.gerente) && req.body.vendedorId) {
      const assigned = await User.findById(req.body.vendedorId);
      if (assigned) {
        const before = String(client?.vendedor?.id || '');
        const after = String(assigned._id);
        if (before !== after) {
          client.vendedor = { id: assigned._id, nombre: assigned.nombre, username: assigned.username };
          cambios.push({
            tipo: "editado",
            mensaje: `Vendedor reasignado a ${assigned.nombre || assigned.username}`,
            fecha: new Date(),
            usuario: usuarioHistorial
          });
        }
      }
    }

    // Agregar cambios al historial
    if (cambios.length > 0) {
      client.historial.push(...cambios);
      console.log(`✅ Agregados ${cambios.length} cambios al historial`);
    }

    // Aplicar cambios al documento (evita sobrescribir arrays sensibles como ventas/historial/vendedor)
    const allowedFields = [
      'nombre',
      'telefono',
      'email',
      'empresa',
      'fecha',
      'compro',
      'observaciones',
      'razonNoCompra',
      'contactosAdicionales'
    ];

    for (const field of allowedFields) {
      if (field === 'compro' && appendedSales) continue;
      if (req.body[field] !== undefined) client[field] = req.body[field];
    }
    await client.save();

    res.json(client);

  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Error actualizando cliente" });
  }
});

// Delete cliente (guarda historial antes)
router.delete('/:id', auth, authorize([ROLES.admin]), async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ msg: "Cliente no encontrado" });

    client.historial.push({
      tipo: 'eliminado',
      mensaje: `Cliente eliminado por ${req.user.nombre || req.user.username}`,
      fecha: new Date(),
      usuario: { id: req.user.id, nombre: req.user.nombre || req.user.username }
    });

    await client.save();
    await Client.findByIdAndDelete(id);
    res.json({ msg: "Cliente eliminado" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Error eliminando cliente" });
  }
});

/* ===================================================
   POST - /clients/:id/ventas   -> agregar venta y registrar historial
   body: { producto, monto, fecha? }
   =================================================== */
router.post('/:id/ventas', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { producto, monto, fecha } = req.body;

    if (!monto || Number(monto) <= 0) {
      return res.status(400).json({ msg: "Monto inválido" });
    }

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ msg: "Cliente no encontrado" });
    if (!canAccessClient(client, req.user)) return res.status(403).json({ msg: "No autorizado" });

    const venta = {
      producto: producto || 'Venta',
      monto: Number(monto),
      fecha: fecha ? new Date(fecha) : new Date()
    };

    client.ventas.push(venta);
    client.compro = true;

    client.historial.push({
      tipo: 'compra',
      mensaje: `💰 $${Number(monto).toLocaleString()} - ${venta.producto}`,
      producto: venta.producto,
      monto: venta.monto,
      fecha: new Date(),
      usuario: { id: req.user.id, nombre: req.user.nombre || req.user.username }
    });

    await client.save();
    res.json(client);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Error registrando venta" });
  }
});

/* ===================================================
   POST - /clients/:id/mensaje  -> guardar mensaje/observación + historial + imagen
   body: { mensaje, imagen? }
   =================================================== */
router.post('/:id/mensaje', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { mensaje, imagen } = req.body;

    if (!mensaje || mensaje.trim() === "") {
      return res.status(400).json({ msg: "Mensaje vacío" });
    }

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ msg: "Cliente no encontrado" });

    // Validar tamaño de imagen (máximo 5MB en base64)
    if (imagen && imagen.length > 7000000) {
      return res.status(400).json({ msg: "Imagen muy grande (máximo 5MB)" });
    }

    // Actualizar observaciones
    client.observaciones = mensaje;

    // Agregar al historial
    client.historial.push({
      tipo: 'mensaje',
      mensaje,
      imagen: imagen || null,
      fecha: new Date(),
      usuario: { 
        id: req.user.id, 
        nombre: req.user.nombre || req.user.username 
      }
    });

    await client.save();
    res.json(client);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Error guardando mensaje" });
  }
});

module.exports = router;
