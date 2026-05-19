const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const ImportService = require('../services/ImportService');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传CSV文件' });
    }

    const records = [];
    const fileBuffer = req.file.buffer;
    
    await new Promise((resolve, reject) => {
      const readable = Readable.from(fileBuffer.toString('utf-8'));
      readable
        .pipe(csv())
        .on('data', (data) => {
          const parsed = ImportService.parseCSVRow(data);
          records.push(parsed);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const operatorId = req.body.operatorId || 'admin';
    const operatorName = req.body.operatorName || '系统管理员';
    
    const results = await ImportService.batchImportAppeals(records, operatorId, operatorName);

    res.json({
      success: true,
      data: {
        total: results.total,
        successCount: results.success.length,
        failedCount: results.failed.length,
        success: results.success,
        failed: results.failed
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/template', (req, res) => {
  const header = '内容类型,内容摘要,作者,作者ID,拦截时间,标签代码,标签名称,置信度,原因代码,原因详情,风险等级,模型版本,申诉人,申诉人ID,联系方式,申诉理由,证据材料\n';
  const example = 'post,测试内容,张三,user001,2024-01-01T00:00:00.000Z,POLITICS,政治敏感,0.85,R001,检测到敏感词汇,high,v2.3.1,张三,user001,13800000000,内容是正常分享,无';
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=import_template.csv');
  res.send('\uFEFF' + header + example);
});

module.exports = router;
