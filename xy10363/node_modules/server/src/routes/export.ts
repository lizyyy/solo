import express from 'express';
import { enrollmentService } from '../services/enrollmentService';
import { BusinessError } from '../utils/errors';

const router = express.Router();

router.get('/classes', (req, res) => {
  try {
    const classSummary = enrollmentService.getClassSummary();
    res.json({
      success: true,
      data: classSummary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取班级汇总失败，请稍后重试',
    });
  }
});

router.get('/export', (req, res) => {
  try {
    const exportData = enrollmentService.getExportData();
    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(400).json({
        success: false,
        message: error.userMessage,
        errorCode: error.code,
      });
    } else {
      res.status(500).json({
        success: false,
        message: '导出数据失败，请稍后重试',
      });
    }
  }
});

export default router;
