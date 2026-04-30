const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const {
  findDevUserByEmail,
  upsertDevUser,
  _devUsers
} = require('../store/devAuthStore');
const { generateTempPassword } = require('../utils/credentials');

async function ensureDevSelfUser(reqUser) {
  const existing = _devUsers.find(
    (u) => u.id === reqUser?.id || u.email === reqUser?.email
  );
  if (existing) return existing;

  const adminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase();
  const reqEmail = String(reqUser?.email || '').toLowerCase();
  const canBootstrapAdmin = Boolean(adminEmail) && reqEmail === adminEmail && Boolean(process.env.ADMIN_PASSWORD);

  if (canBootstrapAdmin) {
    await upsertDevUser({
      name: reqUser?.name || process.env.ADMIN_NAME || 'Dev Admin',
      email: reqUser?.email,
      password: process.env.ADMIN_PASSWORD,
      role: reqUser?.role || process.env.ADMIN_ROLE || 'admin'
    });

    return _devUsers.find(
      (u) => u.id === reqUser?.id || String(u.email || '').toLowerCase() === reqEmail
    );
  }

  return null;
}

async function register(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable' });
    }
    const { name, email, password, role } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const plainPassword = String(password || '');

    if (!normalizedEmail || !plainPassword) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'A valid email is required' });
    }
    if (plainPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const derivedName = String(name || '')
      .trim() || normalizedEmail.split('@')[0] || 'User';

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const hashed = await bcrypt.hash(plainPassword, 10);
    const user = await User.create({ name: derivedName, email: normalizedEmail, password: hashed, role });

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
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

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

      // In dev-auth mode, avoid DB dependency entirely.
      return res.status(401).json({
        message: 'Invalid credentials. In dev mode, use generated login from Employees/Customers pages or admin dev credentials.'
      });
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

async function getMyProfile(req, res, next) {
  try {
    const fallbackProfile = {
      id: req.user?.id,
      name: req.user?.name || '',
      email: req.user?.email || '',
      role: req.user?.role || 'employee',
      source: process.env.DISABLE_AUTH === 'true' ? 'dev' : 'token'
    };

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const devUser = await ensureDevSelfUser(req.user);

      if (!devUser) {
        return res.json(fallbackProfile);
      }

      return res.json({
        id: devUser.id,
        name: devUser.name,
        email: devUser.email,
        role: devUser.role,
        avatarUrl: devUser.avatarUrl || '',
        passwordConfigured: Boolean(devUser.password),
        source: 'dev'
      });
    }

    const user = await User.findById(req.user?.id).select('_id name email role createdAt updatedAt');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      passwordConfigured: true,
      source: 'db'
    });
  } catch (err) {
    next(err);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const nextName = String(req.body?.name || '').trim();
    const nextEmail = String(req.body?.email || '').trim().toLowerCase();

    if (!nextName) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!nextEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const devUser = await ensureDevSelfUser(req.user);
      const index = _devUsers.findIndex((u) => u.id === devUser?.id);

      if (index < 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const emailConflict = _devUsers.some(
        (u, idx) => idx !== index && String(u.email || '').toLowerCase() === nextEmail
      );
      if (emailConflict) {
        return res.status(409).json({ message: 'Email already in use' });
      }

      _devUsers[index] = {
        ..._devUsers[index],
        name: nextName,
        email: nextEmail
      };

      return res.json({
        id: _devUsers[index].id,
        name: _devUsers[index].name,
        email: _devUsers[index].email,
        role: _devUsers[index].role,
        avatarUrl: _devUsers[index].avatarUrl || '',
        passwordConfigured: Boolean(_devUsers[index].password),
        source: 'dev'
      });
    }

    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existing = await User.findOne({ email: nextEmail, _id: { $ne: user._id } }).select('_id');
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    user.name = nextName;
    user.email = nextEmail;
    await user.save();

    return res.json({
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      passwordConfigured: true,
      source: 'db'
    });
  } catch (err) {
    next(err);
  }
}

async function uploadMyAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Avatar file is required' });
    }

    const mime = String(req.file.mimetype || '').toLowerCase();
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ message: 'Only image files are allowed' });
    }

    const uploadRoot = process.env.UPLOADS_DIR
      ? path.resolve(process.env.UPLOADS_DIR)
      : path.join(process.cwd(), 'uploads');
    const profileDir = path.join(uploadRoot, 'profiles');

    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    const extension = mime.includes('png')
      ? 'png'
      : mime.includes('webp')
        ? 'webp'
        : mime.includes('gif')
          ? 'gif'
          : 'jpg';
    const safeId = String(req.user?.id || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeId}_${Date.now()}.${extension}`;
    const targetPath = path.join(profileDir, fileName);
    fs.writeFileSync(targetPath, req.file.buffer);
    const avatarUrl = `/uploads/profiles/${fileName}`;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const devUser = await ensureDevSelfUser(req.user);
      const index = _devUsers.findIndex((u) => u.id === devUser?.id);
      if (index < 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      _devUsers[index] = {
        ..._devUsers[index],
        avatarUrl
      };

      return res.json({
        message: 'Avatar uploaded successfully',
        avatarUrl,
        profile: {
          id: _devUsers[index].id,
          name: _devUsers[index].name,
          email: _devUsers[index].email,
          role: _devUsers[index].role,
          avatarUrl: _devUsers[index].avatarUrl,
          source: 'dev'
        }
      });
    }

    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.avatarUrl = avatarUrl;
    await user.save();

    return res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl,
      profile: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        source: 'db'
      }
    });
  } catch (err) {
    next(err);
  }
}

async function changeMyPassword(req, res, next) {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const devUser = await ensureDevSelfUser(req.user);
      const index = _devUsers.findIndex((u) => u.id === devUser?.id);

      if (index < 0) {
        return res.status(404).json({ message: 'User not found in dev store' });
      }

      const validCurrent = await bcrypt.compare(currentPassword, _devUsers[index].password || '');
      if (!validCurrent) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      _devUsers[index].password = await bcrypt.hash(newPassword, 10);
      return res.json({ message: 'Password updated successfully' });
    }

    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const validCurrent = await bcrypt.compare(currentPassword, user.password);
    if (!validCurrent) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  listUsers,
  resetUserPassword,
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  uploadMyAvatar
};

