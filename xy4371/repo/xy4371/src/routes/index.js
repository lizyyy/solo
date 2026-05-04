const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const importService = require('../services/importService');
const riskService = require('../services/riskService');
const exportService = require('../services/exportService');

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
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

router.post('/import/containers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }
    
    const result = await importService.importContainers(req.file.path);
    
    res.json({
      success: true,
      message: `成功导入 ${result.imported} 条箱体数据`,
      data: result
    });
  } catch (error) {
    console.error('导入箱体数据失败:', error);
    res.status(500).json({ error: '导入失败', message: error.message });
  }
});

router.post('/import/ice-packs', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }
    
    const result = await importService.importIcePacks(req.file.path);
    
    res.json({
      success: true,
      message: `成功导入 ${result.imported} 条冰排数据`,
      data: result
    });
  } catch (error) {
    console.error('导入冰排数据失败:', error);
    res.status(500).json({ error: '导入失败', message: error.message });
  }
});

router.post('/import/loggers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }
    
    const result = await importService.importTemperatureLoggers(req.file.path);
    
    res.json({
      success: true,
      message: `成功导入 ${result.imported} 条温度记录仪数据`,
      data: result
    });
  } catch (error) {
    console.error('导入温度记录仪数据失败:', error);
    res.status(500).json({ error: '导入失败', message: error.message });
  }
});

router.post('/import/batches', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }
    
    const result = await importService.importBatches(req.file.path);
    
    res.json({
      success: true,
      message: `成功导入 ${result.imported} 条批次数据`,
      data: result
    });
  } catch (error) {
    console.error('导入批次数据失败:', error);
    res.status(500).json({ error: '导入失败', message: error.message });
  }
});

router.post('/import/temperature', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }
    
    const result = await importService.importTemperatureRecords(req.file.path);
    
    res.json({
      success: true,
      message: `成功导入 ${result.imported} 条温度记录`,
      data: result
    });
  } catch (error) {
    console.error('导入温度记录失败:', error);
    res.status(500).json({ error: '导入失败', message: error.message });
  }
});

router.post('/import/calibration', express.json(), async (req, res) => {
  try {
    const data = req.body;
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return res.status(400).json({ error: '请提供校准数据' });
    }
    
    const result = await importService.importCalibration(data);
    
    res.json({
      success: true,
      message: `成功导入 ${result.imported} 条校准记录`,
      data: result
    });
  } catch (error) {
    console.error('导入校准数据失败:', error);
    res.status(500).json({ error: '导入失败', message: error.message });
  }
});

router.post('/risks/calculate', async (req, res) => {
  try {
    const risks = await riskService.calculateAllRisks();
    
    const highCount = risks.filter(r => r.risk_level === 'high').length;
    const mediumCount = risks.filter(r => r.risk_level === 'medium').length;
    
    res.json({
      success: true,
      message: `风险计算完成，共发现 ${risks.length} 项风险`,
      summary: {
        total: risks.length,
        high: highCount,
        medium: mediumCount
      },
      data: risks
    });
  } catch (error) {
    console.error('风险计算失败:', error);
    res.status(500).json({ error: '风险计算失败', message: error.message });
  }
});

router.get('/risks', async (req, res) => {
  try {
    const filter = {
      risk_type: req.query.risk_type,
      risk_level: req.query.risk_level,
      review_status: req.query.review_status,
      affected_type: req.query.affected_type
    };
    
    const risks = await riskService.getRiskList(filter);
    
    res.json({
      success: true,
      count: risks.length,
      data: risks
    });
  } catch (error) {
    console.error('查询风险列表失败:', error);
    res.status(500).json({ error: '查询失败', message: error.message });
  }
});

router.post('/risks/:id/review', express.json(), async (req, res) => {
  try {
    const riskId = parseInt(req.params.id);
    const { review_status, review_comment, reviewer_name } = req.body;
    
    if (!review_status) {
      return res.status(400).json({ error: '请提供复核状态' });
    }
    
    const validStatuses = ['pending', 'reviewed', 'cleared', 'confirmed'];
    if (!validStatuses.includes(review_status)) {
      return res.status(400).json({ 
        error: '无效的复核状态', 
        valid_statuses: validStatuses 
      });
    }
    
    const updatedRisk = await riskService.updateRiskReview(riskId, {
      review_status,
      review_comment,
      reviewer_name
    });
    
    if (!updatedRisk) {
      return res.status(404).json({ error: '风险记录不存在' });
    }
    
    res.json({
      success: true,
      message: '复核意见已更新',
      data: updatedRisk
    });
  } catch (error) {
    console.error('更新复核意见失败:', error);
    res.status(500).json({ error: '更新失败', message: error.message });
  }
});

router.get('/export/markdown', async (req, res) => {
  try {
    const markdown = await exportService.generateMarkdownReleaseNote();
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=release-note-${Date.now()}.md`);
    
    res.send(markdown);
  } catch (error) {
    console.error('生成 Markdown 放行单失败:', error);
    res.status(500).json({ error: '生成失败', message: error.message });
  }
});

router.get('/export/json', async (req, res) => {
  try {
    const auditPackage = await exportService.generateJsonAuditPackage();
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=audit-package-${Date.now()}.json`);
    
    res.json(auditPackage);
  } catch (error) {
    console.error('生成 JSON 审计包失败:', error);
    res.status(500).json({ error: '生成失败', message: error.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const { getAsync, allAsync } = require('../config/database');
    
    const containerCount = await getAsync('SELECT COUNT(*) as count FROM containers');
    const batchCount = await getAsync(`SELECT COUNT(*) as count FROM appointment_batches WHERE date(appointment_date) = date('now')`);
    const riskCount = await getAsync(`SELECT COUNT(*) as count FROM risk_assessments WHERE date(calculated_at) = date('now')`);
    const pendingRisks = await getAsync(`SELECT COUNT(*) as count FROM risk_assessments WHERE review_status = 'pending'`);
    
    res.json({
      success: true,
      status: {
        containers: containerCount.count,
        today_batches: batchCount.count,
        today_risks: riskCount.count,
        pending_reviews: pendingRisks.count
      }
    });
  } catch (error) {
    console.error('获取状态失败:', error);
    res.status(500).json({ error: '获取状态失败', message: error.message });
  }
});

module.exports = router;
