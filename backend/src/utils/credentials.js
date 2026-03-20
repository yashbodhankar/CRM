const crypto = require('crypto');

function generateTempPassword(length = 10) {
  const raw = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  return raw.slice(0, length);
}

function normalizeRole(role) {
  const value = (role || '').toLowerCase().trim();
  if (value === 'team lead') return 'lead';
  return value || 'employee';
}

function defaultTeamName(name, role) {
  if (normalizeRole(role) !== 'lead') return '';
  const cleanName = (name || 'Lead').trim();
  return `${cleanName.split(' ')[0]} Team`;
}

module.exports = { generateTempPassword, normalizeRole, defaultTeamName };
