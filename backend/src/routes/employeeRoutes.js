const express = require('express');
const { listEmployees, createEmployee, updateEmployee, deleteEmployee, myTeam } = require('../controllers/employeeController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', auth(), listEmployees);
router.get('/team/my', auth(), myTeam);
router.post('/', auth(['admin', 'manager']), createEmployee);
router.put('/:id', auth(['admin', 'manager', 'lead']), updateEmployee);
router.delete('/:id', auth(['admin']), deleteEmployee);

module.exports = router;

