const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { sendEmail, isEmailEnabled } = require('./email');

let _devNotifications = [];

function normalizeRecipientList(recipients) {
  if (!Array.isArray(recipients)) return [];
  return Array.from(new Set(recipients.map((item) => String(item || '').trim()).filter(Boolean)));
}

async function notifyUsers(recipients, payload) {
  const emails = normalizeRecipientList(recipients);
  if (emails.length === 0) return;

  const docs = emails.map((userEmail) => ({
    userEmail,
    title: String(payload?.title || 'Notification'),
    message: String(payload?.message || ''),
    type: payload?.type || 'info',
    meta: payload?.meta || {}
  }));

  if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
    _devNotifications = docs
      .map((doc) => ({ _id: `dev_notif_${Date.now()}_${Math.random()}`, ...doc, read: false, createdAt: new Date().toISOString() }))
      .concat(_devNotifications)
      .slice(0, 500);
    if (isEmailEnabled()) {
      await Promise.allSettled(
        docs.map((doc) => sendEmail({
          to: doc.userEmail,
          subject: `[CRM] ${doc.title}`,
          text: `${doc.message}\n\nType: ${doc.type}`,
          html: `<p>${doc.message}</p><p><small>Type: ${doc.type}</small></p>`
        }))
      );
    }
    return;
  }

  await Notification.insertMany(docs);

  if (isEmailEnabled()) {
    await Promise.allSettled(
      docs.map((doc) => sendEmail({
        to: doc.userEmail,
        subject: `[CRM] ${doc.title}`,
        text: `${doc.message}\n\nType: ${doc.type}`,
        html: `<p>${doc.message}</p><p><small>Type: ${doc.type}</small></p>`
      }))
    );
  }
}

function listDevNotificationsByUser(userEmail) {
  return _devNotifications.filter((n) => n.userEmail === userEmail);
}

function markDevNotificationRead(id, userEmail) {
  const idx = _devNotifications.findIndex((n) => String(n._id) === String(id) && n.userEmail === userEmail);
  if (idx >= 0) {
    _devNotifications[idx] = { ..._devNotifications[idx], read: true };
    return _devNotifications[idx];
  }
  return null;
}

module.exports = {
  notifyUsers,
  listDevNotificationsByUser,
  markDevNotificationRead
};