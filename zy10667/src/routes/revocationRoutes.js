const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  createRevocationBatch,
  processRevocationBatch,
  processImportAndRevoke,
  exportBatchToCSV,
  getBatchWithHistory,
  getAllBatchesWithSummary
} = require('../services/revocationService');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'revocation-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.get('/', (req, res) => {
  try {
    const batches = getAllBatchesWithSummary();
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const batch = getBatchWithHistory(req.params.id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: '批次不存在'
      });
    }
    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { batchName, operatorName, revocationReason, visitorIds } = req.body;

    if (!visitorIds || !Array.isArray(visitorIds) || visitorIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请选择要撤销的访客'
      });
    }

    const batch = await createRevocationBatch({
      batchName,
      operatorName,
      revocationReason
    }, visitorIds);

    const processedBatch = await processRevocationBatch(batch.id);

    res.status(201).json({
      success: true,
      data: processedBatch.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传CSV文件'
      });
    }

    const operatorName = req.body.operatorName || '系统管理员';
    const result = await processImportAndRevoke(req.file.path, operatorName);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/export', (req, res) => {
  try {
    const csv = exportBatchToCSV(req.params.id);
    const fileName = `撤销批次_${req.params.id}_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/reprocess', async (req, res) => {
  try {
    const batch = await processRevocationBatch(req.params.id);
    res.json({
      success: true,
      data: batch.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
