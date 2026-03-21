const express = require('express');
const auth = require('../middleware/authMiddleware');
const {
  listNotifications,
  markNotificationRead
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/', auth(['notifications:read']), listNotifications);
router.patch('/:id/read', auth(['notifications:read']), markNotificationRead);

module.exports = router;