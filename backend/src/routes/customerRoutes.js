const express = require('express');
const path = require('path');
const multer = require('multer');
const {
	listCustomers,
	createCustomer,
	uploadCustomerDocument
} = require('../controllers/customerController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

const upload = multer({
	dest: path.join(process.cwd(), 'uploads', 'customers'),
	limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', auth(), listCustomers);
router.post('/', auth(['admin', 'manager', 'sales']), createCustomer);
router.post('/:id/documents', auth(['admin', 'manager', 'sales', 'lead']), upload.single('file'), uploadCustomerDocument);

module.exports = router;

