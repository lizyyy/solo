const express = require('express');
const router = express.Router();
const multer = require('multer');
const importer = require('../services/importer');
const riskDetector = require('../services/riskDetector');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/music-licenses', upload.single('file'), async (req, res) => {
  try {
    const { program_id } = req.body;
    
    if (!program_id) {
      return res.status(400).json({ error: 'program_id is required' });
    }
    
    let data;
    if (req.file) {
      data = req.file.buffer.toString('utf-8');
    } else if (req.body.data) {
      data = req.body.data;
    } else {
      return res.status(400).json({ error: 'No file or data provided' });
    }
    
    const results = await importer.importMusicLicenses(data, program_id);
    
    riskDetector.runAllChecks();
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/material-references', upload.single('file'), (req, res) => {
  try {
    const { program_id } = req.body;
    
    if (!program_id) {
      return res.status(400).json({ error: 'program_id is required' });
    }
    
    let data;
    if (req.file) {
      data = JSON.parse(req.file.buffer.toString('utf-8'));
    } else if (req.body.data) {
      data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else {
      return res.status(400).json({ error: 'No file or data provided' });
    }
    
    const results = importer.importMaterialReferences(data, program_id);
    
    riskDetector.runAllChecks();
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ad-schedule', upload.single('file'), (req, res) => {
  try {
    const { program_id } = req.body;
    
    if (!program_id) {
      return res.status(400).json({ error: 'program_id is required' });
    }
    
    let data;
    if (req.file) {
      data = JSON.parse(req.file.buffer.toString('utf-8'));
    } else if (req.body.data) {
      data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else {
      return res.status(400).json({ error: 'No file or data provided' });
    }
    
    const results = importer.importAdSchedule(data, program_id);
    
    riskDetector.runAllChecks();
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/guest-authorization', upload.single('file'), (req, res) => {
  try {
    const { program_id } = req.body;
    
    if (!program_id) {
      return res.status(400).json({ error: 'program_id is required' });
    }
    
    let data;
    if (req.file) {
      data = JSON.parse(req.file.buffer.toString('utf-8'));
    } else if (req.body.data) {
      data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else {
      return res.status(400).json({ error: 'No file or data provided' });
    }
    
    const results = importer.importGuestAuthorization(data, program_id);
    
    riskDetector.runAllChecks();
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/scan', (req, res) => {
  try {
    const results = riskDetector.runAllChecks();
    res.json({
      message: 'Risk scan completed',
      results: {
        expired: results.expired.length,
        expiring: results.expiring.length,
        unauthorized: results.unauthorized.length,
        adDuration: results.adDuration.length,
        duplicates: results.duplicates.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
