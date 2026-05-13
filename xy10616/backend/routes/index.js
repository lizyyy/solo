const express = require('express');
const router = express.Router();
const RenewalController = require('../controllers/renewalController');
const PlateBindingController = require('../controllers/plateBindingController');
const ArrearsController = require('../controllers/arrearsController');
const BlacklistController = require('../controllers/blacklistController');
const DashboardController = require('../controllers/dashboardController');
const ReportController = require('../controllers/reportController');

router.post('/renewal', RenewalController.createRenewal);
router.put('/renewal/:id', RenewalController.updateRenewal);
router.get('/renewal', RenewalController.getRenewals);

router.post('/plate-binding', PlateBindingController.createBinding);
router.put('/plate-binding/:id', PlateBindingController.updateBinding);
router.get('/plate-binding', PlateBindingController.getBindings);
router.get('/plate-binding/:id', PlateBindingController.getBindingDetail);

router.post('/arrears', ArrearsController.createArrear);
router.put('/arrears/:id', ArrearsController.updateArrear);
router.get('/arrears', ArrearsController.getArrears);
router.get('/arrears/:id', ArrearsController.getArrearDetail);

router.post('/blacklist', BlacklistController.addToBlacklist);
router.put('/blacklist/:id/review', BlacklistController.removeFromBlacklist);
router.get('/blacklist', BlacklistController.getBlacklist);

router.get('/dashboard/overview', DashboardController.getOverview);
router.get('/dashboard/abnormal', DashboardController.getAbnormalList);

router.get('/report/export', ReportController.exportReport);
router.get('/flow-records', ReportController.getFlowRecords);

module.exports = router;
