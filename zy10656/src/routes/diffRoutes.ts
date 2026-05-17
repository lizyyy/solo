import { Router, Request, Response } from 'express';
import { diffService } from '../services/diffService';
import { CreateDiffRecordDto, UpdateDiffRecordDto } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const records = diffService.getAllRecords();
  res.json({
    success: true,
    data: records,
    total: records.length
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const record = diffService.getRecord(req.params.id);
  if (!record) {
    return res.status(404).json({
      success: false,
      error: '记录不存在'
    });
  }
  res.json({
    success: true,
    data: record
  });
});

router.get('/:id/history', (req: Request, res: Response) => {
  const record = diffService.getRecord(req.params.id);
  if (!record) {
    return res.status(404).json({
      success: false,
      error: '记录不存在'
    });
  }
  const history = diffService.getHistory(req.params.id);
  res.json({
    success: true,
    data: history,
    total: history.length
  });
});

router.post('/', (req: Request, res: Response) => {
  try {
    const dto = req.body as CreateDiffRecordDto;
    const operator = req.headers['x-operator'] as string || 'system';
    const record = diffService.createRecord(dto, operator);
    res.json({
      success: true,
      data: record
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const dto = req.body as UpdateDiffRecordDto;
    const operator = req.headers['x-operator'] as string || 'system';
    const record = diffService.updateRecord(req.params.id, dto, operator);
    res.json({
      success: true,
      data: record
    });
  } catch (err: any) {
    if (err.message.includes('[RULE_NOT_FOUND]')) {
      return res.status(404).json({
        success: false,
        error: err.message
      });
    }
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/import', (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({
        success: false,
        error: 'rows 必须是数组'
      });
    }
    const operator = req.headers['x-operator'] as string || 'system';
    const result = diffService.batchImport(rows, operator);
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/export/data', (req: Request, res: Response) => {
  const data = diffService.exportRecords();
  res.json({
    success: true,
    data,
    total: data.length
  });
});

router.get('/export/csv', (req: Request, res: Response) => {
  const data = diffService.exportRecords();
  const { Parser } = require('json2csv');
  const json2csvParser = new Parser();
  const csv = json2csvParser.parse(data);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="arrival_diff_records.csv"');
  res.send('\uFEFF' + csv);
});

export default router;
