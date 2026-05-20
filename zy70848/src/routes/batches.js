const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const importService = require('../services/importService');
const ruleEngine = require('../services/ruleEngine');
const claimService = require('../services/claimService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.post('/', async (req, res) => {
  try {
    const { batchName, materialVersion, handler } = req.body;
    const result = await importService.createBatch(batchName, materialVersion, handler);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/import', upload.fields([
  { name: 'materialCSV', maxCount: 1 },
  { name: 'policyJSON', maxCount: 1 }
]), async (req, res) => {
  try {
    const { batchId } = req.params;
    
    if (!req.files.materialCSV || !req.files.policyJSON) {
      return res.status(400).json({ success: false, error: '缺少材料清单CSV或保单JSON文件' });
    }

    const materialCSVPath = req.files.materialCSV[0].path;
    const policyJSONPath = req.files.policyJSON[0].path;

    const materialData = await importService.parseMaterialCSV(materialCSVPath);
    const policyData = await importService.parsePolicyJSON(policyJSONPath);

    const result = await importService.importClaimRecords(batchId, materialData, policyData);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/process', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { handler } = req.body;
    const result = await ruleEngine.processBatch(batchId, handler || 'system');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const batches = await claimService.getBatches();
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
