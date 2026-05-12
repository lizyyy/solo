const express = require('express');
const router = express.Router();
const { validate, schemas } = require('./middleware/validator');
const packageController = require('./controllers/packageController');
const exceptionController = require('./controllers/exceptionController');
const reportController = require('./controllers/reportController');

router.post('/packages/in-stock', validate(schemas.inStock), packageController.inStock);
router.post('/packages/pickup', validate(schemas.pickup), packageController.pickup);
router.get('/packages/:waybill_no/history', packageController.getPackageHistory);

router.post('/exceptions/report', validate(schemas.reportException), exceptionController.reportException);
router.post('/exceptions/confirm-responsibility', validate(schemas.confirmResponsibility), exceptionController.confirmResponsibility);
router.post('/exceptions/close', validate(schemas.closeException), exceptionController.closeException);
router.post('/exceptions/compensate', validate(schemas.compensation), exceptionController.compensate);
router.get('/exceptions', exceptionController.getExceptionList);

router.post('/reports/daily', validate(schemas.dailyReport), reportController.getDailyReport);
router.get('/reports/history', reportController.getOperationHistory);

module.exports = router;
