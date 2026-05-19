const express = require('express');
const router = express.Router();
const {
  upload,
  importVessels,
  importBerthData,
  importTideData
} = require('../controllers/importController');

router.post('/vessels', upload.single('file'), importVessels);
router.post('/berths', upload.single('file'), importBerthData);
router.post('/tides', upload.single('file'), importTideData);

module.exports = router;
