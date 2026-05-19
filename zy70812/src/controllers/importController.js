const { importVesselSchedule, importBerths, importTideSchedule } = require('../utils/importer');
const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

async function importVessels(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await importVesselSchedule(req.file.path);
    res.json({
      success: true,
      message: `Successfully imported ${result.length} vessels`,
      count: result.length,
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function importBerthData(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await importBerths(req.file.path);
    res.json({
      success: true,
      message: `Successfully imported ${result.length} berths`,
      count: result.length,
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function importTideData(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await importTideSchedule(req.file.path);
    res.json({
      success: true,
      message: `Successfully imported ${result.length} tide records`,
      count: result.length,
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  upload,
  importVessels,
  importBerthData,
  importTideData
};
