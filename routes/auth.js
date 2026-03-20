const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { ROLES, isRole } = require('../utils/roles');

router.post('/register', async (req, res) => {
  const { username, password, nombre, role: requestedRole } = req.body;
  if (!username || !password || !nombre) return res.status(400).json({ msg:'Faltan campos' });

  try {
    let user = await User.findOne({ username });
    if (user) return res.status(400).json({ msg:'Usuario ya existe' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    let roleToSet = ROLES.vendedor;

    // Si mandan Authorization y es admin/gerente, permitir crear usuarios (con límites)
    const header = req.headers['authorization'];
    if (header) {
      const token = header.split(' ')[1];
      if (token) {
        try {
          const payload = jwt.verify(token, process.env.JWT_SECRET);
          const creatorRole = payload.role || ROLES.vendedor;

          if (creatorRole === ROLES.admin) {
            roleToSet = isRole(requestedRole) ? requestedRole : ROLES.vendedor;
          } else if (creatorRole === ROLES.gerente) {
            // Gerente solo puede crear vendedores
            roleToSet = ROLES.vendedor;
          }
        } catch (_) {
          // Token inválido: ignorar y registrar como vendedor
        }
      }
    }

    user = new User({ username, password: hash, nombre, role: roleToSet });
    await user.save();

    return res.json({ msg:'Registrado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg:'Error del servidor' });
  }
});

router.post('/login', async (req,res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ msg:'Faltan campos' });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ msg:'Usuario no encontrado' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ msg:'Contraseña inválida' });

    const role = user.role || ROLES.vendedor;
    const token = jwt.sign(
      { id: user._id, username: user.username, nombre: user.nombre, role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({ token, user: { id: user._id, username: user.username, nombre: user.nombre, role } });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ msg:'Error servidor' });
  }
});

router.get('/me', auth, async (req, res) => {
  return res.json({
    id: req.user.id,
    username: req.user.username,
    nombre: req.user.nombre,
    role: req.user.role || ROLES.vendedor
  });
});

router.get('/users', auth, authorize([ROLES.admin]), async (_req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ username: 1 });
    return res.json(users);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error servidor' });
  }
});

// Admin/Gerente: listado reducido para filtros (evita exponer admins a gerentes)
router.get('/sales-users', auth, authorize([ROLES.admin, ROLES.gerente]), async (req, res) => {
  try {
    // Para filtros de análisis: regresar SOLO vendedores.
    // Nota: usuarios viejos pueden no tener `role`; se tratan como vendedores.
    const query = {
      $or: [{ role: ROLES.vendedor }, { role: { $exists: false } }, { role: null }]
    };

    const users = await User.find(query, { password: 0 }).sort({ username: 1 });
    return res.json(users);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error servidor' });
  }
});

router.patch('/users/:id/role', auth, authorize([ROLES.admin]), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!isRole(role)) return res.status(400).json({ msg: 'Rol inválido' });

    const user = await User.findByIdAndUpdate(id, { role }, { new: true, projection: { password: 0 } });
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' });
    return res.json(user);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error servidor' });
  }
});

module.exports = router;
