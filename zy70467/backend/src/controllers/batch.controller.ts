import { Request, Response } from 'express';
import { batchService } from '../services/batch.service';
import { reportService } from '../services/report.service';
import { asyncHandler } from '../middleware/errorHandler';

export const createBatch = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, inputData, createdBy } = req.body;
  const batch = await batchService.createBatch({
    name,
    description,
    inputData,
    createdBy: createdBy || 'admin',
  });
  res.status(201).json({ success: true, data: batch });
});

export const executeBatch = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await batchService.executeBatch(id);
  res.json({ success: true, data: result });
});

export const getBatchList = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, status } = req.query;
  const result = await batchService.getBatchList({
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    status: status as string,
  });
  res.json({ success: true, data: result });
});

export const getBatchDetail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const batch = await batchService.getBatchDetail(id);
  if (!batch) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }
  res.json({ success: true, data: batch });
});

export const getBatchReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const report = await reportService.generateReport(id);
  res.json({ success: true, data: report });
});

export const exportFailedItems = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const csv = await reportService.exportFailedItemsCsv(id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="failed-items-${id}.csv"`);
  res.send('\uFEFF' + csv);
});
