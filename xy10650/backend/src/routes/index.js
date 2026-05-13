const express = require('express');
const multer = require('multer');
const router = express.Router();
const idempotencyCheck = require('../middleware/idempotency');

const HazardController = require('../controllers/hazardController');
const FineController = require('../controllers/fineController');
const TeamController = require('../controllers/teamController');
const ImportExportController = require('../controllers/importExportController');
const LogController = require('../controllers/logController');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/hazards', HazardController.list);
router.post('/hazards', idempotencyCheck(), HazardController.create);
router.get('/hazards/high-risk', HazardController.getHighRiskList);
router.get('/hazards/:id', HazardController.get);
router.put('/hazards/:id/deadline', idempotencyCheck(), HazardController.updateDeadline);
router.post('/hazards/:id/review', idempotencyCheck(), HazardController.submitReview);

router.get('/fines', FineController.list);
router.put('/fines/:id/review', idempotencyCheck(), FineController.review);

router.get('/teams', TeamController.list);
router.post('/teams', TeamController.create);

router.get('/export/hazards', ImportExportController.exportHazards);
router.get('/export/fines', ImportExportController.exportFines);
router.post('/import/hazards', upload.single('file'), ImportExportController.importHazards);

router.get('/logs', LogController.list);
router.get('/logs/timeline/:hazard_id', LogController.timeline);

module.exports = router;