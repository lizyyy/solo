const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');

router.post('/', transferController.createTransfer);
router.get('/', transferController.getTransferList);
router.get('/export', transferController.exportTransfers);
router.get('/:id', transferController.getTransferDetail);
router.get('/:id/history', transferController.getTransferHistory);
router.put('/:id/status', transferController.updateTransferStatus);
router.put('/:id/resolve-conflict', transferController.resolveConflict);
router.put('/:id/archive', transferController.archiveTransfer);

module.exports = router;
