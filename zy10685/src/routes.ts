import express, { Request, Response } from 'express';
import { Parser } from 'json2csv';
import { store } from './store';
import { verificationService } from './service';
import { VerificationRequest, ApiResponse } from './types';

export const router = express.Router();

router.use(express.json());

router.get('/batches', (req: Request, res: Response) => {
  const batches = store.getAllTicketBatches();
  res.json({ success: true, data: batches } as ApiResponse<typeof batches>);
});

router.get('/batches/:id', (req: Request, res: Response) => {
  const batch = store.getTicketBatch(req.params.id);
  if (!batch) {
    res.status(404).json({ success: false, message: '票批次不存在' } as ApiResponse<never>);
    return;
  }
  res.json({ success: true, data: batch } as ApiResponse<typeof batch>);
});

router.get('/batches/:id/history', (req: Request, res: Response) => {
  const batch = store.getTicketBatch(req.params.id);
  if (!batch) {
    res.status(404).json({ success: false, message: '票批次不存在' } as ApiResponse<never>);
    return;
  }
  const records = store.getVerificationRecordsByBatchId(req.params.id);
  res.json({ success: true, data: records } as ApiResponse<typeof records>);
});

router.post('/verify', async (req: Request, res: Response) => {
  const request = req.body as VerificationRequest;
  
  if (!request.batchId || !request.verificationPointId || !request.quantity || !request.operatorName) {
    res.status(400).json({
      success: false,
      message: '缺少必要参数：batchId、verificationPointId、quantity、operatorName'
    } as ApiResponse<never>);
    return;
  }

  const result = await verificationService.verify(request);
  
  if (!result.success) {
    if ((result.error as any).errorCode === 'CONCURRENT_CONFLICT') {
      res.status(409).json(result.error);
    } else {
      res.status(400).json({ success: false, message: (result.error as any).message } as ApiResponse<never>);
    }
    return;
  }

  res.json({ success: true, data: result.data } as ApiResponse<typeof result.data>);
});

router.get('/export/batches', (req: Request, res: Response) => {
  const batches = store.getAllTicketBatches();
  const fields = verificationService.getExportFields();
  const parser = new Parser({ fields: fields.map(f => ({ label: f.label, value: f.value })) });
  const csv = parser.parse(batches);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=票批次列表.csv');
  res.send('\uFEFF' + csv);
});

router.get('/export/records', (req: Request, res: Response) => {
  const records = store.getAllVerificationRecords();
  const fields = verificationService.getRecordExportFields();
  const parser = new Parser({ fields: fields.map(f => ({ label: f.label, value: f.value })) });
  const csv = parser.parse(records);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=核销记录.csv');
  res.send('\uFEFF' + csv);
});

router.post('/import', async (req: Request, res: Response) => {
  const rows = req.body;
  if (!Array.isArray(rows)) {
    res.status(400).json({ success: false, message: '数据格式错误，应为数组' } as ApiResponse<never>);
    return;
  }
  const result = await verificationService.processImport(rows);
  res.json({ success: true, data: result } as ApiResponse<typeof result>);
});

router.get('/verification-points', (req: Request, res: Response) => {
  const points = store.getAllVerificationPoints();
  res.json({ success: true, data: points } as ApiResponse<typeof points>);
});

router.get('/teams', (req: Request, res: Response) => {
  const teams = store.getAllTeams();
  res.json({ success: true, data: teams } as ApiResponse<typeof teams>);
});

router.get('/records', (req: Request, res: Response) => {
  const records = store.getAllVerificationRecords();
  res.json({ success: true, data: records } as ApiResponse<typeof records>);
});
