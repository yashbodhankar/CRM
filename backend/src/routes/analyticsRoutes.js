const express = require('express');
const auth = require('../middleware/authMiddleware');
const { getAnalytics } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/', auth(['admin', 'manager', 'lead']), getAnalytics);

module.exports = router;