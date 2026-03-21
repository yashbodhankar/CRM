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

router.get('/', auth(['customers:read']), listCustomers);
router.get('/:id', auth(['customers:read']), getCustomerById);
router.post('/', auth(['customers:write']), createCustomer);
router.put('/:id', auth(['customers:write']), updateCustomer);
router.delete('/:id', auth(['customers:delete']), deleteCustomer);
router.post('/:id/documents', auth(['customers:write']), upload.single('file'), uploadCustomerDocument);
router.post('/:id/interactions', auth(['customers:write']), addCustomerInteraction);
router.get('/:id/timeline', auth(['customers:read']), listCustomerTimeline);

module.exports = router;

