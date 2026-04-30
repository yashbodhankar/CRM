const express = require('express');
const auth = require('../middleware/authMiddleware');
const {
	listRooms,
	listMessages,
	createMessage,
	updateTypingStatus,
	listTypingUsers,
	clearMessages
} = require('../controllers/chatController');

const router = express.Router();

router.get('/rooms', auth(), listRooms);
router.get('/messages', auth(), listMessages);
router.post('/messages', auth(), createMessage);
router.get('/typing', auth(), listTypingUsers);
router.post('/typing', auth(), updateTypingStatus);
router.post('/messages/clear', auth(), clearMessages);

module.exports = router;
