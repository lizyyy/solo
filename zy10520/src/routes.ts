import express, { Request, Response } from 'express';
import { pollutionService } from './service';
import { CreatePollutionRequest, UpdateStatusRequest, ManualCorrectionRequest, QueryParams, ExportRequest } from './types';

const router = express.Router();

router.post('/pollution', (req: Request, res: Response) => {
  try {
    const request: CreatePollutionRequest = req.body;
    const result = pollutionService.createPollution(request);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/pollution/:id', (req: Request, res: Response) => {
  try {
    const result = pollutionService.getById(req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/pollution', (req: Request, res: Response) => {
  try {
    const params: QueryParams = req.query;
    const result = pollutionService.query(params);
    res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: params.page || 1,
      pageSize: params.pageSize || 20
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/pollution/status', (req: Request, res: Response) => {
  try {
    const request: UpdateStatusRequest = req.body;
    const result = pollutionService.updateStatus(request);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/pollution/correction', (req: Request, res: Response) => {
  try {
    const request: ManualCorrectionRequest = req.body;
    const result = pollutionService.manualCorrection(request);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/pollution/export', (req: Request, res: Response) => {
  try {
    const request: ExportRequest = req.body;
    const result = pollutionService.export(request);
    
    if (request.format === 'CSV') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="pollution-${request.recordId}.csv"`);
      const csvContent = convertToCSV(result);
      res.send(csvContent);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="pollution-${request.recordId}.json"`);
      res.json(result);
    }
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

function convertToCSV(data: any): string {
  const lines: string[] = [];
  
  if (data.basic) {
    lines.push('=== Basic Information ===');
    lines.push('Field,Value');
    Object.entries(data.basic).forEach(([key, value]) => {
      lines.push(`${key},"${value}"`);
    });
    lines.push('');
  }

  if (data.sampleUsers && data.sampleUsers.length > 0) {
    lines.push('=== Sample Users ===');
    const headers = Object.keys(data.sampleUsers[0]).join(',');
    lines.push(headers);
    data.sampleUsers.forEach((user: any) => {
      const values = Object.values(user).map(v => `"${v}"`).join(',');
      lines.push(values);
    });
    lines.push('');
  }

  if (data.metricImpacts && data.metricImpacts.length > 0) {
    lines.push('=== Metric Impacts ===');
    const headers = Object.keys(data.metricImpacts[0]).join(',');
    lines.push(headers);
    data.metricImpacts.forEach((metric: any) => {
      const values = Object.values(metric).map(v => `"${v}"`).join(',');
      lines.push(values);
    });
    lines.push('');
  }

  return lines.join('\n');
}

export default router;
