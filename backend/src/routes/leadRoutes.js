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

router.get('/', auth(['leads:read']), listLeads);
router.post('/', auth(['leads:write']), createLead);
router.put('/:id', auth(['leads:write']), updateLead);
router.get('/:id/score', auth(['leads:read']), getLeadScore);
router.post('/:id/convert', auth(['leads:write']), convertLeadToDeal);
router.delete('/:id', auth(['leads:delete']), deleteLead);

module.exports = router;

