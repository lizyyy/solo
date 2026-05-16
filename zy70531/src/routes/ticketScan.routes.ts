import { Router, Request, Response } from 'express';
import * as ticketScanService from '../services/ticketScan.service';
import { CreateScanRequest, UpdateStatusRequest, ManualCorrectionRequest, ScanStatus } from '../types';
import { createObjectCsvStringifier } from 'csv-writer';

const router = Router();

router.post('/', async (req: Request, res: Response, next) => {
  try {
    const request: CreateScanRequest = req.body;
    const result = await ticketScanService.createScanRequest(request);
    res.status(201).json({
      success: true,
      data: result,
      message: '扫描请求创建成功'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const result = await ticketScanService.getScanRecordById(id);
    if (!result) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: '扫描记录不存在',
        timestamp: new Date().toISOString()
      });
    }
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.get('/ticket/:ticketId', async (req: Request, res: Response, next) => {
  try {
    const { ticketId } = req.params;
    const result = await ticketScanService.getScanRecordsByTicketId(ticketId);
    res.json({
      success: true,
      data: result,
      total: result.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await ticketScanService.getAllScanRecords(page, pageSize);
    res.json({
      success: true,
      data: result.records,
      pagination: {
        page,
        pageSize,
        total: result.total
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/status/:status', async (req: Request, res: Response, next) => {
  try {
    const { status } = req.params;
    const result = await ticketScanService.getScanRecordsByStatus(status as ScanStatus);
    res.json({
      success: true,
      data: result,
      total: result.length
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/status', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const request: UpdateStatusRequest = req.body;
    const result = await ticketScanService.updateScanStatus(id, request);
    if (!result) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: '扫描记录不存在',
        timestamp: new Date().toISOString()
      });
    }
    res.json({
      success: true,
      data: result,
      message: '状态更新成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/failure', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const { errorMessage, rawInput } = req.body;
    const result = await ticketScanService.handleScanFailure(id, errorMessage, rawInput);
    if (!result) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: '扫描记录不存在',
        timestamp: new Date().toISOString()
      });
    }
    res.json({
      success: true,
      data: result,
      message: '异常处理完成，已转入人工审核'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/manual-correction', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const request: ManualCorrectionRequest = req.body;
    const result = await ticketScanService.manualCorrection(id, request);
    if (!result) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: '扫描记录不存在',
        timestamp: new Date().toISOString()
      });
    }
    res.json({
      success: true,
      data: result,
      message: '人工修正完成'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/export/csv', async (req: Request, res: Response, next) => {
  try {
    const { ticketId, status, startDate, endDate } = req.query;
    const records = await ticketScanService.exportScanRecords({
      ticketId: ticketId as string,
      status: status as ScanStatus,
      startDate: startDate as string,
      endDate: endDate as string
    });

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'ticketId', title: '工单编号' },
        { id: 'scanEngine', title: '扫描引擎' },
        { id: 'riskLevel', title: '风险等级' },
        { id: 'isolationAction', title: '隔离动作' },
        { id: 'status', title: '状态' },
        { id: 'processingSummary', title: '处理摘要' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '更新时间' }
      ]
    });

    const csvData = records.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));

    const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(csvData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-scan-export-${Date.now()}.csv"`);
    res.send('\uFEFF' + csvContent);
  } catch (err) {
    next(err);
  }
});

router.get('/export/summary', async (req: Request, res: Response, next) => {
  try {
    const { ticketId, status, startDate, endDate } = req.query;
    const records = await ticketScanService.exportScanRecords({
      ticketId: ticketId as string,
      status: status as ScanStatus,
      startDate: startDate as string,
      endDate: endDate as string
    });

    const summary = ticketScanService.generateExportSummary(records);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
