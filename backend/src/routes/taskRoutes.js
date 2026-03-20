const express = require('express');
const { listTasks, createTask, updateTask, deleteTask } = require('../controllers/taskController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', auth(), listTasks);
router.post('/', auth(['admin', 'manager', 'lead']), createTask);
router.put('/:id', auth(['admin', 'manager', 'lead', 'employee']), updateTask);
router.delete('/:id', auth(['admin', 'manager', 'lead']), deleteTask);

module.exports = router;

