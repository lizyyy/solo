const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const config = require('../config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: config.upload.limits,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.json') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 CSV 或 JSON 文件'));
    }
  }
});

const controllers = require('./controllers');

router.get('/', (req, res) => {
  res.json({
    name: '疫苗运输监控系统 API',
    version: '1.0.0',
    endpoints: {
      import: {
        temperature: 'POST /api/import/temperature',
        trajectory: 'POST /api/import/trajectory',
        handover: 'POST /api/import/handover'
      },
      risk: {
        list: 'GET /api/risks',
        detail: 'GET /api/risks/:id',
        summary: 'GET /api/risks/summary',
        resolve: 'PUT /api/risks/:id/resolve'
      },
      review: {
        list: 'GET /api/reviews',
        create: 'POST /api/reviews',
        detail: 'GET /api/reviews/:id',
        approve: 'PUT /api/reviews/:id/approve',
        reject: 'PUT /api/reviews/:id/reject'
      },
      audit: {
        list: 'GET /api/audit-events'
      },
      export: {
        json: 'GET /api/export/json',
        csv: 'GET /api/export/csv',
        markdown: 'GET /api/export/markdown'
      },
      entities: {
        batches: 'GET /api/batches',
        boxes: 'GET /api/boxes',
        stations: 'GET /api/stations',
        persons: 'GET /api/persons'
      }
    }
  });
});

router.post('/import/temperature', upload.single('file'), controllers.importTemperatureCSV);
router.post('/import/trajectory', upload.single('file'), controllers.importTrajectoryJSON);
router.post('/import/handover', controllers.importHandoverForm);

router.get('/risks', controllers.getRisks);
router.get('/risks/summary', controllers.getRiskSummary);
router.get('/risks/:id', controllers.getRiskById);
router.put('/risks/:id/resolve', controllers.resolveRisk);

router.post('/reviews', controllers.createReview);
router.get('/reviews', controllers.getReviews);
router.get('/reviews/:id', controllers.getReviewById);
router.put('/reviews/:id/approve', controllers.approveReview);
router.put('/reviews/:id/reject', controllers.rejectReview);

router.get('/audit-events', controllers.getAuditEvents);

router.get('/export/json', controllers.exportJSON);
router.get('/export/csv', controllers.exportCSV);
router.get('/export/markdown', controllers.exportMarkdown);

router.get('/batches', controllers.getBatches);
router.get('/batches/:id', controllers.getBatchById);
router.post('/batches', controllers.createBatch);
router.put('/batches/:id', controllers.updateBatch);
router.post('/batches/run-rules', controllers.runRulesForBatches);

router.get('/boxes', controllers.getBoxes);
router.get('/boxes/:id', controllers.getBoxById);
router.post('/boxes', controllers.createBox);
router.put('/boxes/:id', controllers.updateBox);

router.get('/stations', controllers.getStations);
router.get('/stations/:id', controllers.getStationById);
router.post('/stations', controllers.createStation);
router.put('/stations/:id', controllers.updateStation);

router.get('/persons', controllers.getPersons);
router.get('/persons/:id', controllers.getPersonById);
router.post('/persons', controllers.createPerson);
router.put('/persons/:id', controllers.updatePerson);

router.get('/handover-forms', controllers.getHandoverForms);
router.get('/handover-forms/:id', controllers.getHandoverFormById);
router.post('/handover-forms/:id/sign-sender', controllers.signHandoverFormSender);
router.post('/handover-forms/:id/sign-receiver', controllers.signHandoverFormReceiver);

module.exports = router;
