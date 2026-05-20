import { Router, Request, Response } from 'express';
import multer from 'multer';
import BatchService from '../services/BatchService';
import CsvImportService from '../services/CsvImportService';
import ApplicationService from '../services/ApplicationService';
import { BatchStatus } from '../models/Batch';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, importedBy, remark } = req.body;
    if (!name || !importedBy) {
      return res.status(400).json({ error: '批次名称和导入人不能为空' });
    }
    const batch = await BatchService.createBatch(name, importedBy, remark);
    res.json(batch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as BatchStatus;
    const result = await BatchService.listBatches(page, pageSize, status);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const batch = await BatchService.getBatchById(parseInt(req.params.id));
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(batch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.id);
    const operator = req.body.operator || 'system';
    
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const result = await CsvImportService.importFromBuffer(
      batchId,
      req.file.buffer,
      operator
    );

    await BatchService.updateBatchStatus(batchId, BatchStatus.PROCESSING);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/applications', async (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    
    const result = await ApplicationService.listApplications(page, pageSize, { batchId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const batch = await BatchService.updateBatchStatus(parseInt(req.params.id), status);
    res.json(batch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
