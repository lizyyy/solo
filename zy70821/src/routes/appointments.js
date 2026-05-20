const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const controller = require('../controllers/appointmentController');

router.post('/upload', upload.fields([
  { name: 'appointments', maxCount: 10 },
  { name: 'inventory', maxCount: 1 },
  { name: 'rules', maxCount: 1 }
]), controller.uploadAppointments);

router.get('/batch/:batchId', controller.getBatchResult);

router.get('/inventory', controller.getVaccineInventory);
router.put('/inventory', express.json(), controller.updateInventory);

router.get('/rules', controller.getContraindicationRules);
router.put('/rules', express.json(), controller.updateRules);

module.exports = router;
