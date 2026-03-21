const express = require('express');
const auth = require('../middleware/authMiddleware');
const { getAnalytics, getAdvancedAnalytics } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/', auth(['analytics:read']), getAnalytics);
router.get('/advanced', auth(['analytics:read']), getAdvancedAnalytics);

module.exports = router;