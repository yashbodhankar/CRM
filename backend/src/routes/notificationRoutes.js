const express = require('express');
const auth = require('../middleware/authMiddleware');
const {
  listNotifications,
  markNotificationRead
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/', auth(), listNotifications);
router.patch('/:id/read', auth(), markNotificationRead);

module.exports = router;