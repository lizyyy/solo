const express = require('express');
const router = express.Router();
const controller = require('../controllers/sparePartsController');
const { validateSparePart, validateBatchImport, validateId, validatePartCode } = require('../middleware/validation');

router.get('/', controller.getAllSpareParts);
router.get('/export', controller.exportSpareParts);
router.get('/purchase-suggestions', controller.getPurchaseSuggestions);
router.get('/code/:part_code', validatePartCode, controller.getSparePartByCode);
router.get('/:id', validateId, controller.getSparePartById);
router.post('/', validateSparePart, controller.createSparePart);
router.post('/batch-import', validateBatchImport, controller.batchImportSpareParts);
router.put('/:id', validateId, validateSparePart, controller.updateSparePart);
router.delete('/:id', validateId, controller.deleteSparePart);

module.exports = router;
