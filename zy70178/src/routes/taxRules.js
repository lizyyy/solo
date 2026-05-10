const express = require('express');
const router = express.Router();
const TaxRuleController = require('../controllers/TaxRuleController');

router.post('/', TaxRuleController.createRule);
router.get('/', TaxRuleController.getAllRules);
router.get('/active', TaxRuleController.getActiveRules);
router.get('/applicable', TaxRuleController.findApplicableRule);
router.get('/:id', TaxRuleController.getRuleById);
router.put('/:id', TaxRuleController.updateRule);
router.post('/:id/deactivate', TaxRuleController.deactivateRule);
router.post('/:id/activate', TaxRuleController.activateRule);
router.post('/init/defaults', TaxRuleController.initializeDefaultRules);

module.exports = router;
