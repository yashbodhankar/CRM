const express = require('express');
const multer = require('multer');
const {
	register,
	login,
	listUsers,
	resetUserPassword,
	getMyProfile,
	updateMyProfile,
	changeMyPassword,
	uploadMyAvatar
} = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();
const upload = multer({
	limits: {
		fileSize: 3 * 1024 * 1024
	}
});

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.get('/me', auth(), getMyProfile);
router.put('/me', auth(), updateMyProfile);
router.put('/me/password', auth(), changeMyPassword);
router.post('/me/avatar', auth(), upload.single('avatar'), uploadMyAvatar);
router.get('/users', auth(['admin']), listUsers);
router.post('/users/:id/reset-password', auth(['admin']), resetUserPassword);

module.exports = router;

