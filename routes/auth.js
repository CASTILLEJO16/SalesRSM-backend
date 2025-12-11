const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/register', async (req, res) => {
  const { username, password, nombre } = req.body;
  if (!username || !password || !nombre) return res.status(400).json({ msg:'Faltan campos' });

  try {
    let user = await User.findOne({ username });
    if (user) return res.status(400).json({ msg:'Usuario ya existe' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    user = new User({ username, password: hash, nombre });
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

    const token = jwt.sign({ id: user._id, username: user.username, nombre: user.nombre }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token, user: { id: user._id, username: user.username, nombre: user.nombre } });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ msg:'Error servidor' });
  }
});

module.exports = router;
