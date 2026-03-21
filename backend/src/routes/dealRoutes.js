const express = require('express');
const auth = require('../middleware/authMiddleware');
const { listDeals, getDealById, createDeal, updateDeal, deleteDeal } = require('../controllers/dealController');

const router = express.Router();

router.get('/', auth(['admin', 'manager', 'sales', 'lead']), listDeals);
router.get('/:id', auth(['admin', 'manager', 'sales', 'lead']), getDealById);
router.post('/', auth(['admin', 'manager', 'sales', 'lead']), createDeal);
router.put('/:id', auth(['admin', 'manager', 'sales', 'lead']), updateDeal);
router.patch('/:id', auth(['admin', 'manager', 'sales', 'lead']), updateDeal);
router.delete('/:id', auth(['admin', 'manager', 'sales', 'lead']), deleteDeal);

module.exports = router;