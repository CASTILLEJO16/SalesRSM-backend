const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ msg:'No token' });
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ msg:'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ msg:'Token inválido' });
  }
};
