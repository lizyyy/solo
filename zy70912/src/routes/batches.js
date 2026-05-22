const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../data/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ storage });

const {
  createBatchHandler,
  importCSVHandler,
  importFlightHandler,
  importPhotoHandler,
  listBatchesHandler,
  getBatchHandler
} = require('../controllers/batchController');

router.post('/', createBatchHandler);
router.get('/', listBatchesHandler);
router.get('/:id', getBatchHandler);
router.post('/import/csv', upload.single('csv_file'), importCSVHandler);
router.post('/import/flight', importFlightHandler);
router.post('/import/photo', importPhotoHandler);

module.exports = router;
