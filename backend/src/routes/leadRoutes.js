const express = require('express');
const {
	listLeads,
	createLead,
	updateLead,
	deleteLead,
	getLeadScore,
	convertLeadToDeal
} = require('../controllers/leadController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', auth(), listLeads);
router.post('/', auth(['admin', 'sales', 'manager', 'lead']), createLead);
router.put('/:id', auth(['admin', 'sales', 'manager', 'lead']), updateLead);
router.get('/:id/score', auth(['admin', 'manager', 'sales', 'lead']), getLeadScore);
router.post('/:id/convert', auth(['admin', 'manager', 'sales', 'lead']), convertLeadToDeal);
router.delete('/:id', auth(['admin', 'manager', 'sales', 'lead']), deleteLead);

module.exports = router;

