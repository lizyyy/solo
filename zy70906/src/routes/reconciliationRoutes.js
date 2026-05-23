const express = require('express');
const multer = require('multer');
const reconController = require('../controllers/reconciliationController');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const routes = (app) => {
  app.use('/api/recon', router);

  router.post('/import/receipts', upload.single('file'), reconController.importReceipts);
  router.post('/import/members', upload.single('file'), reconController.importMembers);
  router.post('/run', reconController.runReconciliation);
  router.get('/list', reconController.getReconciliations);
  router.get('/report', reconController.getReport);
  router.get('/summary', reconController.getSummary);
  router.get('/:id', reconController.getReconciliation);
  router.put('/:id/approve', reconController.approveReconciliation);
  router.put('/:id/reject', reconController.rejectReconciliation);
};

module.exports = routes;
