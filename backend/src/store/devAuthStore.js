const bcrypt = require('bcryptjs');

let _devUsers = [];

async function upsertDevUser({ name, email, password, role }) {
  const hashed = await bcrypt.hash(password, 10);
  const existingIdx = _devUsers.findIndex((u) => u.email === email);
  const next = {
    id: existingIdx >= 0 ? _devUsers[existingIdx].id : `dev_user_${Date.now()}`,
    name,
    email,
    role,
    password: hashed
  };

  if (existingIdx >= 0) {
    _devUsers[existingIdx] = next;
  } else {
    _devUsers.push(next);
  }

  return next;
}

function findDevUserByEmail(email) {
  return _devUsers.find((u) => u.email === email) || null;
}

function removeDevUserByEmail(email) {
  const idx = _devUsers.findIndex((u) => u.email === email);
  if (idx >= 0) {
    return _devUsers.splice(idx, 1)[0];
  }
  return null;
}

module.exports = { upsertDevUser, findDevUserByEmail, removeDevUserByEmail, _devUsers };
