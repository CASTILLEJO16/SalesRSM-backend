const ROLES = {
  admin: 'admin',
  gerente: 'gerente',
  vendedor: 'vendedor'
};

const isRole = (role) => Object.values(ROLES).includes(role);

module.exports = { ROLES, isRole };

