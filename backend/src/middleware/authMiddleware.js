const jwt = require('jsonwebtoken');

const ROLE_PERMISSIONS = {
  admin: ['*'],
  manager: [
    'dashboard:read',
    'analytics:read',
    'employees:read',
    'employees:write',
    'projects:read',
    'projects:write',
    'tasks:read',
    'tasks:write',
    'leads:read',
    'leads:write',
    'leads:delete',
    'customers:read',
    'customers:write',
    'customers:delete',
    'deals:read',
    'deals:write',
    'deals:delete',
    'notifications:read'
  ],
  sales: [
    'dashboard:read',
    'leads:read',
    'leads:write',
    'leads:delete',
    'customers:read',
    'customers:write',
    'customers:delete',
    'deals:read',
    'deals:write',
    'deals:delete',
    'tasks:read',
    'notifications:read'
  ],
  lead: [
    'dashboard:read',
    'analytics:read',
    'employees:read',
    'employees:write',
    'projects:read',
    'tasks:read',
    'tasks:write',
    'leads:read',
    'leads:write',
    'leads:delete',
    'customers:read',
    'customers:write',
    'customers:delete',
    'deals:read',
    'deals:write',
    'deals:delete',
    'notifications:read'
  ],
  employee: ['dashboard:read', 'projects:read', 'tasks:read', 'tasks:update-own', 'notifications:read'],
  customer: ['dashboard:read', 'projects:read-own', 'tasks:read-own-project', 'notifications:read']
};

function hasPermission(role, permission) {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes('*') || allowed.includes(permission);
}

function isPermissionToken(token) {
  return String(token || '').includes(':');
}

function isAuthorized(required, role) {
  if (!Array.isArray(required) || required.length === 0) return true;
  return required.some((item) => {
    if (isPermissionToken(item)) {
      return hasPermission(role, item);
    }
    return item === role;
  });
}

function auth(requiredRoles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    // Dev convenience: prefer provided token (to keep role/email), else fallback to admin identity.
    if (process.env.DISABLE_AUTH === 'true') {
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
          req.user = decoded;
        } catch (err) {
          req.user = { id: 'dev', role: 'admin', email: process.env.ADMIN_EMAIL || 'admin@example.com' };
        }
      } else {
        req.user = { id: 'dev', role: 'admin', email: process.env.ADMIN_EMAIL || 'admin@example.com' };
      }

      if (!isAuthorized(requiredRoles, req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      return next();
    }

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      if (!isAuthorized(requiredRoles, decoded.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}

module.exports = auth;

