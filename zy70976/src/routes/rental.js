const express = require('express');
const router = express.Router();
const RentalController = require('../controllers/RentalController');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

router.post('/batches', RentalController.createBatch);
router.get('/batches', RentalController.getBatches);
router.get('/batches/:batch_id', RentalController.getBatchDetails);

router.post('/import/rental-csv', upload.single('file'), RentalController.importRentalCSV);
router.post('/import/repair-json', RentalController.importRepairJSON);
router.post('/import/deposit-rules', RentalController.importDepositRules);

router.post('/:id/process', RentalController.processRental);
router.post('/:id/return', RentalController.returnForModification);
router.get('/:id/details', RentalController.getRentalDetails);

router.get('/search', RentalController.searchRentals);
router.get('/export', RentalController.exportRentals);

router.get('/device/:serial', RentalController.searchByDeviceSerial);
router.get('/deposit-flow/:flow_id', RentalController.searchByDepositFlow);

router.get('/exceptions/unresolved', RentalController.getUnresolvedExceptions);
router.post('/exceptions/:id/resolve', RentalController.resolveException);

router.get('/deposit-rules', RentalController.getDepositRules);
router.get('/repairs', RentalController.getRepairRecords);
router.get('/operation-logs', RentalController.getOperationLogs);

module.exports = router;
