const express = require('express');
const { listProjects, createProject, updateProject, deleteProject } = require('../controllers/projectController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', auth(), listProjects);
router.post('/', auth(['admin', 'manager']), createProject);
router.put('/:id', auth(['admin', 'manager']), updateProject);
router.delete('/:id', auth(['admin', 'manager']), deleteProject);

module.exports = router;

