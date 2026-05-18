import { Router, Request, Response } from 'express';
import multer from 'multer';
import { adjustmentService } from '../services/adjustment.service';
import { batchImportService } from '../services/batch-import.service';
import { exportService } from '../services/export.service';
import { AdjustmentStatus, AdjustmentType } from '../types';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/create', async (req: Request, res: Response) => {
  try {
    const result = await adjustmentService.createAdjustment(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '创建调码记录失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.post('/:id/submit-review', async (req: Request, res: Response) => {
  try {
    const { reviewerId, reviewerName } = req.body;
    const result = await adjustmentService.submitForReview(req.params.id, reviewerId, reviewerName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '提交审核失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { reviewRemarks } = req.body;
    const result = await adjustmentService.approveAdjustment(req.params.id, reviewRemarks);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '审核失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.post('/:id/confirm-return', async (req: Request, res: Response) => {
  try {
    const result = await adjustmentService.confirmOldEquipmentReturned(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '确认归还失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const result = await adjustmentService.completeAdjustment(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '完成调码失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const result = adjustmentService.getAdjustmentDetail(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '获取详情失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const { page, pageSize, status, rentalPointCode, customerName } = req.query;
    const result = adjustmentService.getAdjustmentList({
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      status: status as AdjustmentStatus | undefined,
      rentalPointCode: rentalPointCode as string | undefined,
      customerName: customerName as string | undefined
    });
    res.json({
      success: true,
      data: result,
      message: '查询成功'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '查询列表失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.post('/batch/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传CSV文件',
        errorCode: 'NO_FILE'
      });
    }

    const { operatorId, operatorName, rentalPointCode, rentalPointName } = req.body;

    const result = await batchImportService.importAdjustments(
      req.file.buffer,
      operatorId,
      operatorName,
      rentalPointCode,
      rentalPointName
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '批量导入失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.get('/batch/template', (req: Request, res: Response) => {
  try {
    const template = batchImportService.getImportTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=adjustment_import_template.csv');
    res.send('\uFEFF' + template);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '获取模板失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.get('/export/csv', (req: Request, res: Response) => {
  try {
    const { status, rentalPointCode, startDate, endDate } = req.query;
    const result = exportService.exportAdjustmentsToCSV({
      status: status as AdjustmentStatus | undefined,
      rentalPointCode: rentalPointCode as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined
    });

    if (result.success && result.data) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=adjustments_export_${Date.now()}.csv`);
      res.send('\uFEFF' + result.data);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '导出失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.get('/export/statistics', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, rentalPointCode } = req.query;
    const result = exportService.getExportStatistics({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      rentalPointCode: rentalPointCode as string | undefined
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '获取统计数据失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

router.get('/enums/types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(AdjustmentType),
    message: '获取调码类型成功'
  });
});

router.get('/enums/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(AdjustmentStatus),
    message: '获取调码状态成功'
  });
});

export default router;
