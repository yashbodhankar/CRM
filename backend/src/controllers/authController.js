const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const {
  findDevUserByEmail,
  upsertDevUser,
  _devUsers
} = require('../store/devAuthStore');
const { generateTempPassword } = require('../utils/credentials');

async function register(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable' });
    }
    const { name, email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const derivedName = String(name || '')
      .trim() || String(email).split('@')[0] || 'User';

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name: derivedName, email, password: hashed, role });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Dev-mode: allow login with generated credentials and keep admin bootstrap.
    if (process.env.DISABLE_AUTH === 'true') {
      const devEmail = process.env.ADMIN_EMAIL;
      const devPassword = process.env.ADMIN_PASSWORD;
      const jwtSecret = process.env.JWT_SECRET || 'dev_secret';

      if (devEmail && devPassword && email === devEmail && password === devPassword) {
        const token = jwt.sign(
          { id: 'dev', name: process.env.ADMIN_NAME || 'Dev Admin', email: devEmail, role: process.env.ADMIN_ROLE || 'admin' },
          jwtSecret,
          { expiresIn: '1d' }
        );
        return res.json({ token });
      }

      // Fallback bootstrap admin for local setup if ADMIN_* vars are not configured.
      if (!devEmail && !devPassword && email === 'admin@example.com' && password === 'admin123') {
        await upsertDevUser({ name: 'Dev Admin', email, password, role: 'admin' });
        const token = jwt.sign(
          { id: 'dev_admin_bootstrap', name: 'Dev Admin', email, role: 'admin' },
          jwtSecret,
          { expiresIn: '1d' }
        );
        return res.json({ token });
      }

      const devUser = findDevUserByEmail(email);
      if (devUser) {
        const isMatch = await bcrypt.compare(password, devUser.password);
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
          { id: devUser.id, name: devUser.name, email: devUser.email, role: devUser.role },
          jwtSecret,
          { expiresIn: '1d' }
        );
        return res.json({ token });
      }

      // If dev creds not present or don't match, fall through to DB check (if available)
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const users = _devUsers
        .slice()
        .reverse()
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          passwordConfigured: Boolean(u.password),
          source: 'dev'
        }));
      return res.json(users);
    }

    const users = await User.find({}, 'name email role createdAt').sort({ createdAt: -1 });
    return res.json(
      users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        passwordConfigured: true,
        source: 'db'
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function resetUserPassword(req, res, next) {
  try {
    const { id } = req.params;
    const tempPassword = generateTempPassword();

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const index = _devUsers.findIndex((u) => u.id === id);
      if (index < 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const hashed = await bcrypt.hash(tempPassword, 10);
      _devUsers[index] = {
        ..._devUsers[index],
        password: hashed
      };

      return res.json({
        id: _devUsers[index].id,
        email: _devUsers[index].email,
        role: _devUsers[index].role,
        temporaryPassword: tempPassword,
        message: 'Temporary password reset successfully'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = await bcrypt.hash(tempPassword, 10);
    await user.save();

    return res.json({
      id: String(user._id),
      email: user.email,
      role: user.role,
      temporaryPassword: tempPassword,
      message: 'Temporary password reset successfully'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, listUsers, resetUserPassword };

