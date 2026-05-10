const express = require('express');
const MasterDataController = require('../controllers/MasterDataController');

const router = express.Router();

router.get('/enterprises', MasterDataController.getEnterprises);
router.post('/enterprises', MasterDataController.createEnterprise);
router.put('/enterprises/:enterpriseCode', MasterDataController.updateEnterprise);

router.get('/periods', MasterDataController.getPeriods);
router.post('/periods', MasterDataController.createPeriod);
router.put('/periods/:periodCode', MasterDataController.updatePeriod);

router.get('/rules', MasterDataController.getRules);
router.post('/rules', MasterDataController.createRule);
router.put('/rules/:ruleCode', MasterDataController.updateRule);

module.exports = router;
