const jwt = require('jsonwebtoken');

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

      if (requiredRoles.length > 0 && !requiredRoles.includes(req.user.role)) {
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

      if (
        requiredRoles.length > 0 &&
        !requiredRoles.includes(decoded.role)
      ) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}

module.exports = auth;

