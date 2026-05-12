const express = require('express');
const archiveController = require('../controllers/archiveController');

const router = express.Router();

router.post('/submit', archiveController.submitSlowRequest);
router.get('/', archiveController.listArchives);
router.get('/:id', archiveController.getArchive);
router.put('/:id/status', archiveController.updateStatus);
router.put('/:id/notes', archiveController.updateNotes);
router.put('/:id/assign', archiveController.assignResponsible);
router.put('/:id/false-positive', archiveController.markFalsePositive);
router.get('/trace/:trace_id', archiveController.getSimilarByTraceId);

module.exports = router;
