import { Router, Request, Response } from 'express';
import { SummaryDAO, FailedRecordDAO } from '../database/dao';
import { ExportService } from '../services/exportService';
import { ApiResponse, PaginatedResponse } from '../types';

const router = Router();

function getOperatorInfo(req: Request): { operatorId: string; operatorName: string } {
  return {
    operatorId: req.headers['x-operator-id'] as string || 'system',
    operatorName: req.headers['x-operator-name'] as string || '系统管理员'
  };
}

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await SummaryDAO.getFinancialSummary();

    res.json({
      success: true,
      data: summary
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.post('/summary/export', async (req: Request, res: Response) => {
  try {
    const filePath = await ExportService.exportFinancialSummaryToCSV();

    res.json({
      success: true,
      data: { filePath },
      message: '财务汇总导出成功'
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.get('/failed-records', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const resolved = req.query.resolved === 'true' ? true : 
                     req.query.resolved === 'false' ? false : undefined;

    const { data, total } = await FailedRecordDAO.findAll(resolved, page, pageSize);

    res.json({
      success: true,
      data: {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    } as ApiResponse<PaginatedResponse<any>>);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.post('/failed-records/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { operatorId } = getOperatorInfo(req);
    const { notes } = req.body;

    await FailedRecordDAO.resolve(req.params.id, operatorId, notes);

    res.json({
      success: true,
      message: '失败记录已标记为已解决'
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.get('/export-files', async (req: Request, res: Response) => {
  try {
    const files = await ExportService.getExportFiles();

    res.json({
      success: true,
      data: files
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

export default router;
