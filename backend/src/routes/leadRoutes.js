const express = require('express');
const {
	listLeads,
	createLead,
	updateLead,
	deleteLead,
	getLeadScore
} = require('../controllers/leadController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', auth(), listLeads);
router.post('/', auth(['admin', 'sales', 'manager', 'lead']), createLead);
router.put('/:id', auth(['admin', 'sales', 'manager', 'lead']), updateLead);
router.get('/:id/score', auth(['admin', 'manager', 'sales', 'lead']), getLeadScore);
router.delete('/:id', auth(['admin', 'manager']), deleteLead);

module.exports = router;

