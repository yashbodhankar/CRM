const express = require('express');
const {
	listProjects,
	createProject,
	updateProject,
	deleteProject,
	addCustomerProjectUpdate,
	submitProjectCompletion,
	verifyProjectCompletion,
	updateMilestoneCompletion,
	updateSubtaskCompletion
} = require('../controllers/projectController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', auth(), listProjects);
router.post('/', auth(['admin', 'manager']), createProject);
router.put('/:id', auth(['admin', 'manager']), updateProject);
router.post('/:id/customer-update', auth(['customer']), addCustomerProjectUpdate);
router.post('/:id/submit-completion', auth(['lead']), submitProjectCompletion);
router.post('/:id/verify-completion', auth(['admin', 'customer']), verifyProjectCompletion);
router.patch('/:id/milestones/:milestoneId', auth(['admin', 'manager', 'lead']), updateMilestoneCompletion);
router.patch('/:id/milestones/:milestoneId/subtasks/:subtaskId', auth(['admin', 'manager', 'lead']), updateSubtaskCompletion);
router.delete('/:id', auth(['admin', 'manager']), deleteProject);

module.exports = router;

