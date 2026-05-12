import { Request, Response } from 'express';
import { reportService } from '../services/reportService';
import { AppResponse } from '../models';
import { BusinessError } from '../services/equipmentService';

function handleError(res: Response, error: any) {
  if (error instanceof BusinessError) {
    return res.status(400).json({
      success: false,
      error: error.message,
      errorCode: error.code
    } as AppResponse<null>);
  }
  console.error(error);
  return res.status(500).json({
    success: false,
    error: '服务器内部错误'
  } as AppResponse<null>);
}

export async function getEquipmentStatus(req: Request, res: Response) {
  try {
    const status = await reportService.getEquipmentStatus(req.params.id);
    res.json({ success: true, data: status } as AppResponse<typeof status>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getExceptionTimeline(req: Request, res: Response) {
  try {
    const timeline = await reportService.getExceptionTimeline(req.params.id);
    res.json({ success: true, data: timeline } as AppResponse<typeof timeline>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getShiftInspectionReport(req: Request, res: Response) {
  try {
    const report = await reportService.getShiftInspectionReport(req.params.id);
    res.json({ success: true, data: report } as AppResponse<typeof report>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const { date } = req.query;
    const stats = await reportService.getDashboardStats(date as string);
    res.json({ success: true, data: stats } as AppResponse<typeof stats>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getHistory(req: Request, res: Response) {
  try {
    const { entityType, entityId } = req.params;
    const history = await reportService.getHistory(entityType, entityId);
    res.json({ success: true, data: history } as AppResponse<typeof history>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function exportShiftReportCSV(req: Request, res: Response) {
  try {
    const { shiftDate, shift } = req.query;
    if (!shiftDate) {
      return res.status(400).json({ success: false, error: '请提供shiftDate参数' });
    }
    const csv = await reportService.exportShiftReportCSV(shiftDate as string, shift as string);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="shift-report-${shiftDate}.csv"`);
    res.send('\ufeff' + csv);
  } catch (error) {
    handleError(res, error);
  }
}
