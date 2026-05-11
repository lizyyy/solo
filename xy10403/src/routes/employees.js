const express = require('express');
const employeeController = require('../controllers/employeeController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticateToken, requireRole(['admin']), employeeController.createEmployee);
router.get('/', authenticateToken, employeeController.getEmployees);
router.get('/:id', authenticateToken, employeeController.getEmployeeById);
router.put('/:id', authenticateToken, requireRole(['admin']), employeeController.updateEmployee);
router.delete('/:id', authenticateToken, requireRole(['admin']), employeeController.deleteEmployee);

module.exports = router;
