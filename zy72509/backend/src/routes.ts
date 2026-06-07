import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  confirmRecord,
  rejectRecord,
  sendToAlgorithmReview,
  importFromExcel,
  exportRecords,
  getConflicts,
} from './services/recordService';
import {
  runSelfCheck,
  getSelfCheckResults,
  resolveSelfCheck,
} from './services/selfCheckService';
import { ReviewStatus } from './types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/records', (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as ReviewStatus | undefined;
  const keyword = req.query.keyword as string | undefined;

  const result = getRecords({ page, pageSize, status, keyword });
  res.json(result);
});

router.get('/records/:id', (req: Request, res: Response) => {
  const record = getRecordById(req.params.id);
  if (!record) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }
  res.json(record);
});

router.post('/records', (req: Request, res: Response) => {
  const record = createRecord(req.body);
  res.status(201).json(record);
});

router.put('/records/:id', (req: Request, res: Response) => {
  const record = updateRecord(req.params.id, req.body);
  if (!record) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }
  res.json(record);
});

router.post('/records/:id/confirm', (req: Request, res: Response) => {
  const record = confirmRecord(req.params.id);
  if (!record) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }
  res.json(record);
});

router.post('/records/:id/reject', (req: Request, res: Response) => {
  const record = rejectRecord(req.params.id);
  if (!record) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }
  res.json(record);
});

router.post('/records/:id/algorithm-review', (req: Request, res: Response) => {
  const record = sendToAlgorithmReview(req.params.id);
  if (!record) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }
  res.json(record);
});

router.get('/conflicts', (req: Request, res: Response) => {
  const conflicts = getConflicts();
  res.json(conflicts);
});

router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传文件' });
    return;
  }
  const result = importFromExcel(req.file.buffer, req.file.originalname);
  res.json(result);
});

router.get('/export', (req: Request, res: Response) => {
  const idsParam = req.query.ids as string;
  const recordIds = idsParam ? idsParam.split(',') : undefined;
  const buffer = exportRecords(recordIds);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="越权拦截记录_${Date.now()}.xlsx"`);
  res.send(buffer);
});

router.post('/self-check/run', (req: Request, res: Response) => {
  const results = runSelfCheck();
  res.json({ results, count: results.length });
});

router.get('/self-check', (req: Request, res: Response) => {
  const onlyUnresolved = req.query.all ? false : true;
  const results = getSelfCheckResults(onlyUnresolved);
  res.json(results);
});

router.post('/self-check/:id/resolve', (req: Request, res: Response) => {
  resolveSelfCheck(req.params.id);
  res.json({ success: true });
});

export default router;
