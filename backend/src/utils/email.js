const nodemailer = require('nodemailer');

let transporter;

function isEmailEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!isEmailEnabled()) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) return { skipped: true, reason: 'smtp-not-configured' };

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  await t.sendMail({ from, to, subject, text, html });
  return { skipped: false };
}

module.exports = {
  isEmailEnabled,
  sendEmail
};
