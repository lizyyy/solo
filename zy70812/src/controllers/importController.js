const { importVesselSchedule, importBerths, importTideSchedule } = require('../utils/importer');
const { logOperation } = require('../utils/logger');
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

    const { create_records, batch_id, created_by } = req.body;
    const options = {
      create_records: create_records === 'true' || create_records === true,
      batch_id: batch_id ? parseInt(batch_id) : null,
      created_by: created_by || 'system'
    };

    const result = await importVesselSchedule(req.file.path, options);
    
    if (options.create_records && options.batch_id) {
      await logOperation({
        batch_id: options.batch_id,
        operation_type: 'batch_import',
        operation_status: 'success',
        handled_by: options.created_by,
        details: { imported_count: result.length, import_type: 'vessels' }
      });
    }

    res.json({
      success: true,
      message: options.create_records 
        ? `Successfully imported ${result.length} vessels and created scheduling records`
        : `Successfully imported ${result.length} vessels`,
      count: result.length,
      create_records: options.create_records,
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
