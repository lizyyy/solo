const express = require('express');
const EvaluationController = require('../controllers/EvaluationController');

const router = express.Router();

router.post('/', EvaluationController.create);
router.get('/enums', EvaluationController.getEnums);
router.get('/export', EvaluationController.export);
router.post('/batch-import', EvaluationController.batchImport);
router.get('/:id', EvaluationController.getById);
router.put('/:id', EvaluationController.update);
router.delete('/:id', EvaluationController.delete);
router.get('/', EvaluationController.list);

module.exports = router;
