/**
 * API 路由定义
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const controller = require('../controllers/apiController');

const router = express.Router();

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 确保 uploads 目录存在
const fs = require('fs');
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 健康检查
router.get('/health', controller.healthCheck);

// 装修申请
router.post('/decoration/upload', upload.single('file'), controller.uploadDecorationFile);
router.post('/decoration/process', controller.processRawDecoration);
router.get('/decoration', controller.listApplications);
router.get('/decoration/:id', controller.getDecorationDetail);

// 巡检记录
router.post('/inspection/upload', upload.single('file'), controller.uploadInspectionFile);
router.post('/inspection', controller.addInspection);

// 扣款规则
router.post('/rules/upload', upload.single('file'), controller.uploadDeductionRules);
router.get('/rules', controller.listRules);
router.post('/rules', controller.addRule);

// 审批
router.post('/approval/process', controller.processApproval);
router.post('/approval/deduction', controller.executeDeduction);

// 退款
router.post('/refund/create', controller.createRefund);
router.post('/refund/confirm/:id', controller.confirmRefund);
router.get('/refund/:id/trace', controller.getRefundTrace);
router.get('/refund', controller.listRefunds);

// 统计
router.get('/stats', controller.getStats);

// 批次检查
router.get('/batch/:fingerprint', controller.checkBatch);

module.exports = router;
