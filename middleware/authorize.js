module.exports = function authorize(allowedRoles = []) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return function(req, res, next) {
    const role = req.user?.role || 'vendedor';
    if (allowed.length === 0 || allowed.includes(role)) return next();
    return res.status(403).json({ msg: 'No autorizado' });
  };
};

