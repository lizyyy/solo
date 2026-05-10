const express = require('express');
const DeclarationController = require('../controllers/DeclarationController');

const router = express.Router();

router.get('/', DeclarationController.getDeclarations);
router.get('/:enterpriseCode/:periodCode', DeclarationController.getDeclaration);
router.post('/:enterpriseCode/:periodCode/validate', DeclarationController.validateDeclaration);
router.post('/:enterpriseCode/:periodCode/submit', DeclarationController.submitDeclaration);
router.post('/:enterpriseCode/:periodCode/manual-correct', DeclarationController.manualCorrectStatus);
router.get('/:enterpriseCode/:periodCode/history', DeclarationController.getDeclarationHistory);
router.get('/:enterpriseCode/:periodCode/report', DeclarationController.generateReport);
router.get('/statistics/summary', DeclarationController.getStatistics);

module.exports = router;
