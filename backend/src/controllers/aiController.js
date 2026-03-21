const nodemailer = require('nodemailer');

function buildRuleBasedReply(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (!text.trim()) return 'Please provide your CRM question.';
  if (text.includes('lead')) return 'Focus on high-score leads first, then schedule follow-up tasks within 24 hours.';
  if (text.includes('customer')) return 'Check customer timeline (calls/emails/meetings) before the next interaction for context.';
  if (text.includes('deal')) return 'Move deals stage-by-stage and track expected close date with weekly reminders.';
  if (text.includes('task')) return 'Prioritize overdue tasks and assign ownership with a clear due date.';
  return 'Recommended action: review analytics, prioritize conversion opportunities, and schedule follow-ups.';
}

function buildEmailDraft({ customerName, company, context }) {
  const name = customerName || 'there';
  const org = company ? ` at ${company}` : '';
  const extra = context ? `\n\nContext:\n${context}` : '';
  return {
    subject: `Follow-up from CRM Team${org}`,
    body: `Hi ${name},\n\nI hope you are doing well. I wanted to follow up regarding our previous conversation and help with the next steps.\n\nPlease let me know a convenient time for a quick call.\n\nBest regards,\nCRM Team${extra}`
  };
}

async function crmAssistant(req, res, next) {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    const reply = buildRuleBasedReply(prompt);
    return res.json({ reply });
  } catch (err) {
    next(err);
  }
}

async function generateEmailDraft(req, res, next) {
  try {
    const draft = buildEmailDraft(req.body || {});
    return res.json(draft);
  } catch (err) {
    next(err);
  }
}

async function sendEmail(req, res, next) {
  try {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass) {
      return res.status(400).json({ message: 'SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    const to = String(req.body?.to || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!to || !subject || !body) {
      return res.status(400).json({ message: 'to, subject and body are required' });
    }

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: body
    });

    return res.json({ message: 'Email sent', id: info.messageId });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  crmAssistant,
  generateEmailDraft,
  sendEmail
};