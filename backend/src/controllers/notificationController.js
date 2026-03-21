const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const {
  listDevNotificationsByUser,
  markDevNotificationRead
} = require('../utils/notify');

async function listNotifications(req, res, next) {
  try {
    const email = req.user?.email;
    const limit = Math.min(Number(req.query?.limit || 30), 100);

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      return res.json(listDevNotificationsByUser(email).slice(0, limit));
    }

    const notifications = await Notification.find({ userEmail: email })
      .sort({ createdAt: -1 })
      .limit(limit);
    return res.json(notifications);
  } catch (err) {
    next(err);
  }
}

async function markNotificationRead(req, res, next) {
  try {
    const id = req.params.id;
    const email = req.user?.email;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const updated = markDevNotificationRead(id, email);
      if (!updated) return res.status(404).json({ message: 'Notification not found' });
      return res.json(updated);
    }

    const updated = await Notification.findOneAndUpdate(
      { _id: id, userEmail: email },
      { $set: { read: true } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Notification not found' });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listNotifications,
  markNotificationRead
};