const express = require('express');
const auth = require('../middleware/authMiddleware');
const {
  crmAssistant,
  generateEmailDraft,
  sendEmail
} = require('../controllers/aiController');

const router = express.Router();

router.post('/assistant', auth(), crmAssistant);
router.post('/email-draft', auth(['admin', 'manager', 'sales', 'lead']), generateEmailDraft);
router.post('/send-email', auth(['admin', 'manager', 'sales', 'lead']), sendEmail);

module.exports = router;