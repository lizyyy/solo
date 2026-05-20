const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { processInspectionData } = require('./services/inspectionService');
const { generateBatchId, isBatchProcessed, markBatchAsProcessed } = require('./services/batchService');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

app.use(express.json());

app.post('/api/upload', upload.fields([
  { name: 'inspectionCsv', maxCount: 1 },
  { name: 'sensorJson', maxCount: 1 },
  { name: 'approvalForm', maxCount: 1 }
]), async (req, res) => {
  try {
    const batchId = generateBatchId(req.files, req.body);
    
    if (isBatchProcessed(batchId)) {
      return res.status(409).json({
        success: false,
        message: '该批次材料已提交过，请勿重复提交',
        batchId: batchId
      });
    }

    const result = await processInspectionData(req.files, req.body);
    
    markBatchAsProcessed(batchId, result);

    res.json({
      success: true,
      batchId: batchId,
      summary: {
        total: result.normal.length + result.pendingConfirmation.length + result.failed.length,
        normal: result.normal.length,
        pendingConfirmation: result.pendingConfirmation.length,
        failed: result.failed.length
      },
      data: result
    });
  } catch (error) {
    console.error('处理失败:', error);
    res.status(500).json({
      success: false,
      message: '处理失败: ' + error.message
    });
  }
});

app.get('/api/batch/:batchId', (req, res) => {
  const { batchId } = req.params;
  const result = isBatchProcessed(batchId);
  
  if (!result) {
    return res.status(404).json({
      success: false,
      message: '未找到该批次记录'
    });
  }

  res.json({
    success: true,
    data: result
  });
});

app.listen(PORT, () => {
  console.log(`🚀 景区缆车检修API服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📁 上传目录: ${uploadDir}`);
});
