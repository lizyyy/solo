const express = require('express');
const multer = require('multer');
const {
  createBatch,
  uploadData,
  configureMapping,
  runPrecheck,
  fixError,
  runTrialImport,
  confirmImport,
  rollbackBatch,
  getBatchDetail,
  listBatches,
} = require('../services/importService');
const { getAllFields } = require('../utils/fieldDefinitions');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const DEFAULT_OPERATOR = 'system';

router.get('/fields/:batchType', (req, res) => {
  try {
    const { batchType } = req.params;
    const fields = getAllFields(batchType);
    res.json({
      success: true,
      data: fields,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { batchName, batchType } = req.body;
    const operator = req.headers['x-operator'] || DEFAULT_OPERATOR;
    
    if (!batchName || !batchType) {
      return res.status(400).json({
        success: false,
        message: '批次名称和类型不能为空',
      });
    }
    
    const batch = await createBatch(batchName, batchType, operator);
    res.json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { batchType, status, page = 1, pageSize = 20 } = req.query;
    const result = await listBatches(
      batchType,
      status,
      parseInt(page),
      parseInt(pageSize)
    );
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const detail = await getBatchDetail(batchId);
    
    if (!detail) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }
    
    res.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:batchId/upload', upload.single('file'), async (req, res) => {
  try {
    const { batchId } = req.params;
    const operator = req.headers['x-operator'] || DEFAULT_OPERATOR;
    
    let dataType, content, fileName;
    
    if (req.file) {
      const originalName = req.file.originalname.toLowerCase();
      if (originalName.endsWith('.csv')) {
        dataType = 'csv';
        content = req.file.buffer.toString('utf-8');
      } else if (originalName.endsWith('.json')) {
        dataType = 'json';
        content = JSON.parse(req.file.buffer.toString('utf-8'));
      } else {
        return res.status(400).json({
          success: false,
          message: '仅支持 CSV 和 JSON 格式文件',
        });
      }
      fileName = req.file.originalname;
    } else if (req.body.pastedContent) {
      const pasted = req.body.pastedContent.trim();
      if (pasted.startsWith('{') || pasted.startsWith('[')) {
        dataType = 'json';
        content = JSON.parse(pasted);
      } else {
        dataType = 'csv';
        content = pasted;
      }
      fileName = 'pasted-data';
    } else {
      return res.status(400).json({
        success: false,
        message: '请上传文件或粘贴数据',
      });
    }
    
    const result = await uploadData(batchId, dataType, content, fileName, operator);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:batchId/mapping', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { mappingConfig } = req.body;
    const operator = req.headers['x-operator'] || DEFAULT_OPERATOR;
    
    if (!mappingConfig || typeof mappingConfig !== 'object') {
      return res.status(400).json({
        success: false,
        message: '字段映射配置不能为空',
      });
    }
    
    const batch = await configureMapping(batchId, mappingConfig, operator);
    res.json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:batchId/precheck', async (req, res) => {
  try {
    const { batchId } = req.params;
    const operator = req.headers['x-operator'] || DEFAULT_OPERATOR;
    
    const result = await runPrecheck(batchId, operator);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:batchId/errors/:errorId/fix', async (req, res) => {
  try {
    const { batchId, errorId } = req.params;
    const { fixedValue } = req.body;
    const operator = req.headers['x-operator'] || DEFAULT_OPERATOR;
    
    const error = await fixError(batchId, parseInt(errorId), fixedValue, operator);
    res.json({
      success: true,
      data: error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:batchId/trial', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { fileHash } = req.body;
    const operator = req.headers['x-operator'] || DEFAULT_OPERATOR;
    
    const result = await runTrialImport(batchId, operator, fileHash);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:batchId/confirm', async (req, res) => {
  try {
    const { batchId } = req.params;
    const operator = req.headers['x-operator'] || DEFAULT_OPERATOR;
    
    const result = await confirmImport(batchId, operator);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:batchId/rollback', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { reason } = req.body;
    const operator = req.headers['x-operator'] || DEFAULT_OPERATOR;
    
    const result = await rollbackBatch(batchId, reason, operator);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
