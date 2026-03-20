const express = require('express');
const { listCustomers, createCustomer } = require('../controllers/customerController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', auth(), listCustomers);
router.post('/', auth(['admin', 'manager', 'sales']), createCustomer);

module.exports = router;

