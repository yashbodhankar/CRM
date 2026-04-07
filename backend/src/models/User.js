const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    role: {
      type: String,
      enum: ['admin', 'manager', 'sales', 'lead', 'employee', 'customer'],
      default: 'employee',
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

