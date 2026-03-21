const express = require('express');
const path = require('path');
const multer = require('multer');
const {
	listCustomers,
	getCustomerById,
	createCustomer,
	updateCustomer,
	deleteCustomer,
	uploadCustomerDocument,
	addCustomerInteraction,
	listCustomerTimeline
} = require('../controllers/customerController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

const upload = multer({
	dest: path.join(process.cwd(), 'uploads', 'customers'),
	limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', auth(), listCustomers);
router.get('/:id', auth(), getCustomerById);
router.post('/', auth(['admin', 'manager', 'sales', 'lead']), createCustomer);
router.put('/:id', auth(['admin', 'manager', 'sales', 'lead']), updateCustomer);
router.delete('/:id', auth(['admin', 'manager', 'sales', 'lead']), deleteCustomer);
router.post('/:id/documents', auth(['admin', 'manager', 'sales', 'lead']), upload.single('file'), uploadCustomerDocument);
router.post('/:id/interactions', auth(['admin', 'manager', 'sales', 'lead']), addCustomerInteraction);
router.get('/:id/timeline', auth(), listCustomerTimeline);

module.exports = router;

