import { Request, Response, NextFunction, Router } from 'express';
import { DefectService } from '../services/DefectService';
import { ExportService } from '../services/ExportService';
import { DefectStatus } from '../models/types';

const defectService = new DefectService();
const exportService = new ExportService();
const router = Router();

export const defectRouter = router;

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defect = await defectService.createDefect(req.body);
    res.status(201).json({
      success: true,
      data: defect
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { procurementOrderNo, equipmentNo, status } = req.query;
    const defects = await defectService.getDefects({
      procurementOrderNo: procurementOrderNo as string,
      equipmentNo: equipmentNo as string,
      status: status as DefectStatus
    });
    res.json({
      success: true,
      data: defects
    });
  } catch (error) {
    next(error);
  }
});

router.get('/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defects = await defectService.getOverdueDefects();
    res.json({
      success: true,
      data: defects
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defect = await defectService.getDefectById(req.params.id);
    if (!defect) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `缺陷不存在: ${req.params.id}`
        }
      });
      return;
    }
    res.json({
      success: true,
      data: defect
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defect = await defectService.updateDefectStatus(req.params.id, req.body);
    res.json({
      success: true,
      data: defect
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/correct', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defect = await defectService.manualCorrect(req.params.id, req.body);
    res.json({
      success: true,
      data: defect,
      message: '人工修正已记录'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export/csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { procurementOrderNo } = req.query;
    const csv = await exportService.exportToCSV(procurementOrderNo as string);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="defects-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.get('/export/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { procurementOrderNo } = req.query;
    if (!procurementOrderNo) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAM',
          message: '必须提供采购单号'
        }
      });
      return;
    }
    const pdfBuffer = await exportService.exportToPDF(procurementOrderNo as string);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="defect-report-${procurementOrderNo}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});
