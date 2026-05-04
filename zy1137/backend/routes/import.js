const express = require('express');
const multer = require('multer');
const DataImporter = require('../services/dataImporter');
const RiskAnalyzer = require('../services/riskAnalyzer');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { sendSuccess } = require('../utils/response');

const router = express.Router();
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/json',
      'application/jsonl',
      'text/plain'
    ];
    const allowedExtensions = ['.csv', '.json', '.jsonl'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new AppError('不支持的文件类型', 400, 'INVALID_FILE_TYPE'), false);
    }
  }
});

router.post('/devices', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('请上传文件', 400, 'MISSING_FILE');
  }

  const { updateExisting = 'true' } = req.body;

  const importer = new DataImporter();
  const result = await importer.importDevices(req.file.buffer, {
    updateExisting: updateExisting === 'true'
  });

  return sendSuccess(res, {
    filename: req.file.originalname,
    fileSize: req.file.size,
    ...result
  }, `设备导入完成：${result.created} 条新建, ${result.updated} 条更新, ${result.skipped} 条跳过`);
}));

router.post('/ble-scans', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('请上传文件', 400, 'MISSING_FILE');
  }

  const { linkToDevice = 'true' } = req.body;

  const importer = new DataImporter();
  const result = await importer.importBleScans(req.file.buffer, {
    linkToDevice: linkToDevice === 'true'
  });

  return sendSuccess(res, {
    filename: req.file.originalname,
    fileSize: req.file.size,
    ...result
  }, `扫描记录导入完成：${result.created} 条新建, ${result.skipped} 条跳过`);
}));

router.post('/pairing-events', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('请上传文件', 400, 'MISSING_FILE');
  }

  const { linkToDevice = 'true' } = req.body;

  const importer = new DataImporter();
  const result = await importer.importPairingEvents(req.file.buffer, {
    linkToDevice: linkToDevice === 'true'
  });

  return sendSuccess(res, {
    filename: req.file.originalname,
    fileSize: req.file.size,
    ...result
  }, `配对事件导入完成：${result.created} 条新建, ${result.skipped} 条跳过`);
}));

router.post('/zones', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('请上传文件', 400, 'MISSING_FILE');
  }

  const { updateExisting = 'true' } = req.body;

  const importer = new DataImporter();
  const result = await importer.importZones(req.file.buffer, {
    updateExisting: updateExisting === 'true'
  });

  return sendSuccess(res, {
    filename: req.file.originalname,
    fileSize: req.file.size,
    ...result
  }, `区域数据导入完成：${result.created} 条新建, ${result.updated} 条更新, ${result.skipped} 条跳过`);
}));

router.post('/batch', upload.fields([
  { name: 'devices', maxCount: 1 },
  { name: 'bleScans', maxCount: 1 },
  { name: 'pairingEvents', maxCount: 1 },
  { name: 'zones', maxCount: 1 }
]), asyncHandler(async (req, res) => {
  const results = {};
  const importer = new DataImporter();

  if (req.files?.devices?.[0]) {
    results.devices = await importer.importDevices(req.files.devices[0].buffer);
  }

  if (req.files?.zones?.[0]) {
    results.zones = await importer.importZones(req.files.zones[0].buffer);
  }

  if (req.files?.bleScans?.[0]) {
    results.bleScans = await importer.importBleScans(req.files.bleScans[0].buffer);
  }

  if (req.files?.pairingEvents?.[0]) {
    results.pairingEvents = await importer.importPairingEvents(req.files.pairingEvents[0].buffer);
  }

  const totalCreated = Object.values(results).reduce((sum, r) => sum + (r.created || 0), 0);
  const totalErrors = Object.values(results).reduce((sum, r) => sum + (r.errors?.length || 0), 0);

  return sendSuccess(res, {
    results,
    summary: {
      totalCreated,
      totalErrors
    }
  }, `批量导入完成：共 ${totalCreated} 条记录`);
}));

router.post('/analyze', asyncHandler(async (req, res) => {
  const { since, force = false, runRandomAddress = true, runDuplicateDetection = true } = req.body;

  const analyzer = new RiskAnalyzer();
  
  const deviceAnalysis = await analyzer.analyzeAllDevices({
    since: since ? new Date(since) : null,
    force: force === true
  });

  let randomAddressResult = { detected: false, groups: [] };
  if (runRandomAddress) {
    randomAddressResult = await analyzer.detectRandomAddressDrift({
      since: since ? new Date(since) : null
    });
  }

  let duplicateResult = { detected: false, duplicates: [] };
  if (runDuplicateDetection) {
    duplicateResult = await analyzer.detectDuplicateDevices();
  }

  return sendSuccess(res, {
    deviceAnalysis,
    randomAddressDetection: randomAddressResult,
    duplicateDetection: duplicateResult
  }, '风险分析完成');
}));

module.exports = router;
