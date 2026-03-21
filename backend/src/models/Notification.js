const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info'
    },
    read: { type: Boolean, default: false },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

notificationSchema.index({ userEmail: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);