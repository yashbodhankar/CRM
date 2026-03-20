const express = require('express');
const {
	register,
	login,
	listUsers,
	resetUserPassword
} = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/users', auth(['admin']), listUsers);
router.post('/users/:id/reset-password', auth(['admin']), resetUserPassword);

module.exports = router;

