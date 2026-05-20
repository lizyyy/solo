import { Router, Request, Response } from 'express';
import { transferService } from '../services/TransferService';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, branchId, createdBy, description } = req.body;
    const batch = await transferService.createBatch(name, branchId, createdBy, description);
    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ error: '创建批次失败' });
  }
});

router.post('/:batchId/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    const records = await transferService.parseCSV(req.file.buffer, batchId);
    await transferService.addRecordsToBatch(batchId, records);
    res.status(200).json({ 
      message: `成功导入 ${records.length} 条记录`,
      recordsWithIssues: records.filter(r => r.issues.length > 0).length
    });
  } catch (error) {
    res.status(500).json({ error: '导入CSV失败' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const batches = await transferService.getAllBatches();
    res.status(200).json(batches);
  } catch (error) {
    res.status(500).json({ error: '获取批次列表失败' });
  }
});

router.get('/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const batch = await transferService.getBatchById(batchId);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.status(200).json(batch);
  } catch (error) {
    res.status(500).json({ error: '获取批次失败' });
  }
});

export default router;
