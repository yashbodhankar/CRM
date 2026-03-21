const express = require('express');
const auth = require('../middleware/authMiddleware');
const { listDeals, getDealById, createDeal, updateDeal, deleteDeal } = require('../controllers/dealController');

const router = express.Router();

router.get('/', auth(['deals:read']), listDeals);
router.get('/:id', auth(['deals:read']), getDealById);
router.post('/', auth(['deals:write']), createDeal);
router.put('/:id', auth(['deals:write']), updateDeal);
router.patch('/:id', auth(['deals:write']), updateDeal);
router.delete('/:id', auth(['deals:delete']), deleteDeal);

module.exports = router;