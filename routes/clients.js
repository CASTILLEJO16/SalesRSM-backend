const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const auth = require('../middleware/auth');

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

    // 🔧 FIX: Crear fecha sin conversión UTC
    let fechaCliente;
    if (fecha) {
      const partes = fecha.split('-');
      fechaCliente = new Date(partes[0], partes[1] - 1, partes[2]);
    } else {
      const ahora = new Date();
      fechaCliente = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
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
      vendedor: {
        id: req.user.id,
        nombre: req.user.nombre,
        username: req.user.username
      }
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
    const clients = await Client.find().sort({ fecha: -1 });
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

    const cambios = [];
    
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
          fecha: new Date()
        });
      }
    }

    // 2️⃣ Detectar cambio en observaciones
    if (req.body.observaciones !== undefined && 
        req.body.observaciones !== client.observaciones) {
      cambios.push({
        tipo: "mensaje",
        mensaje: req.body.observaciones,
        fecha: new Date()
      });
    }

    // 3️⃣ Detectar NUEVAS VENTAS (array ventas creció)
    const ventasAnteriores = client.ventas?.length || 0;
    const ventasNuevas = req.body.ventas?.length || 0;
    
    if (ventasNuevas > ventasAnteriores) {
      // Agregar historial por cada venta nueva
      const nuevasVentasArray = req.body.ventas.slice(ventasAnteriores);
      
      nuevasVentasArray.forEach(venta => {
        cambios.push({
          tipo: "compra",
          mensaje: `Venta registrada: ${venta.producto || 'Producto'}`,
          monto: venta.monto,
          fecha: new Date()
        });
      });
    }

    // 4️⃣ Detectar cambios en contactos adicionales
    if (req.body.contactosAdicionales && 
        JSON.stringify(req.body.contactosAdicionales) !== JSON.stringify(client.contactosAdicionales)) {
      cambios.push({
        tipo: "editado",
        mensaje: "Contactos adicionales actualizados",
        fecha: new Date()
      });
    }

    // Agregar cambios al historial
    if (cambios.length > 0) {
      client.historial.push(...cambios);
      console.log(`✅ Agregados ${cambios.length} cambios al historial`);
    }

    // Aplicar cambios al documento
    Object.assign(client, req.body);
    await client.save();

    res.json(client);

  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Error actualizando cliente" });
  }
});

// Delete cliente (guarda historial antes)
router.delete('/:id', auth, async (req, res) => {
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

    const venta = {
      producto: producto || 'Venta',
      monto: Number(monto),
      fecha: fecha ? new Date(fecha) : new Date()
    };

    client.ventas.push(venta);
    client.compro = true; // marcar que compró

    // 🔥 CAMBIAR 'venta' por 'compra' para que coincida con el frontend
    client.historial.push({
      tipo: 'compra', // ✅ CAMBIO AQUÍ
      mensaje: `💰 $${Number(monto).toLocaleString()} - ${venta.producto}`,
      producto: venta.producto,
      monto: venta.monto,
      fecha: new Date(), // ✅ usar new Date() para fecha actual
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
    const { mensaje, imagen } = req.body; // ✅ Agregar imagen

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
      imagen: imagen || null, // ✅ Guardar imagen
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
