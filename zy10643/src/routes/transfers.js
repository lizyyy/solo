const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');

router.post('/', transferController.createTransfer);
router.post('/process', transferController.processTransfer);
router.post('/confirm', transferController.confirmBooking);
router.post('/reject', transferController.rejectTransfer);
router.post('/resubmit', transferController.resubmitTransfer);
router.post('/manual-review', transferController.manualReviewTransfer);
router.get('/', transferController.getTransferList);
router.get('/export', transferController.exportTransfers);
router.post('/import', transferController.importTransfers);
router.get('/:id', transferController.getTransferById);
router.get('/:id/history', transferController.getTransferHistory);

module.exports = router;
