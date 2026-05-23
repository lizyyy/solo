const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const ImportService = require('../services/importService');
const { AppError } = require('../middleware/errorHandler');

router.post('/orders/csv', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('请上传CSV文件', 400);
    }

    const result = await ImportService.importOrdersCSV(req.file.path);

    res.status(200).json({
      success: true,
      message: '订单数据导入成功',
      data: {
        traceId: result.traceId,
        successCount: result.successCount,
        totalCount: result.results.length,
        results: result.results
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/charger-logs/json', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('请上传JSON文件', 400);
    }

    const result = await ImportService.importChargerLogsJSON(req.file.path);

    res.status(200).json({
      success: true,
      message: '充电日志数据导入成功',
      data: {
        traceId: result.traceId,
        successCount: result.successCount
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/payment-records', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('请上传文件', 400);
    }

    const result = await ImportService.importPaymentRecords(req.file.path);

    res.status(200).json({
      success: true,
      message: '支付记录数据导入成功',
      data: {
        traceId: result.traceId,
        successCount: result.successCount
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
