const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function seedAdmin() {
  if (process.env.SEED_ADMIN !== 'true') {
    return;
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin User';
  const role = process.env.ADMIN_ROLE || 'admin';

  if (!email || !password) {
    console.warn('SEED_ADMIN is true but ADMIN_EMAIL or ADMIN_PASSWORD is not set, skipping admin seeding');
    return;
  }
  try {
    // if DB isn't connected this will throw quickly thanks to serverSelectionTimeoutMS
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`Admin user already exists (${email}), skipping seeding`);
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed, role });
    console.log(`Seeded admin user: ${email}`);
  } catch (err) {
    console.warn('Admin seeding skipped (DB unavailable):', err.message);
  }
}

module.exports = seedAdmin;

