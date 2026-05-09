const express = require('express');
const BudgetLockController = require('../controllers/budget-lock.controller');

const router = express.Router();
const controller = new BudgetLockController();

router.post('/departments', (req, res) => controller.createDepartment(req, res));
router.post('/budgets', (req, res) => controller.createBudget(req, res));
router.get('/budgets/:budgetId', (req, res) => controller.getBudget(req, res));
router.post('/locks', (req, res) => controller.lockBudget(req, res));
router.get('/locks/:lockId', (req, res) => controller.getLock(req, res));
router.put('/locks/:lockId', (req, res) => controller.updateLock(req, res));
router.post('/locks/:lockId/release', (req, res) => controller.releaseLock(req, res));
router.post('/locks/:lockId/commit', (req, res) => controller.commitLock(req, res));
router.get('/locks/application/:applicationId', (req, res) => controller.getLockByApplication(req, res));

module.exports = router;
