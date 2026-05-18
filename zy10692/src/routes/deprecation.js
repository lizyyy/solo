const express = require('express');
const router = express.Router();
const deprecationController = require('../controllers/deprecationController');

router.post('/import', deprecationController.batchImport.bind(deprecationController));
router.post('/:id/confirm', deprecationController.confirm.bind(deprecationController));
router.post('/:id/revoke', deprecationController.revoke.bind(deprecationController));
router.get('/validate-publish', deprecationController.validatePublish.bind(deprecationController));
router.get('/', deprecationController.getAll.bind(deprecationController));
router.get('/statistics', deprecationController.getStatistics.bind(deprecationController));
router.get('/export', deprecationController.exportCSV.bind(deprecationController));
router.get('/:id', deprecationController.getById.bind(deprecationController));

module.exports = router;