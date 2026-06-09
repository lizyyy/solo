import express, { type Request, type Response } from 'express';
import { MaterialService } from '../services/MaterialService.js';
import { SummaryService } from '../services/SummaryService.js';
import { RerunService } from '../services/RerunService.js';
import type { JudgeRequest, RerunRequest, ImportItem, MaterialStatus } from '../../shared/types.js';

const router = express.Router();

router.get('/summary', (req: Request, res: Response) => {
  try {
    const summary = SummaryService.getSummary();
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, specialty, search, page, pageSize } = req.query;
    const result = MaterialService.getMaterials({
      status: status as MaterialStatus | undefined,
      specialty: specialty as string | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效的材料ID' });
    }
    const material = MaterialService.getById(id);
    if (!material) {
      return res.status(404).json({ success: false, error: '材料不存在' });
    }
    res.json({ success: true, data: material });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/judge', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效的材料ID' });
    }
    const body = req.body as JudgeRequest;
    if (!body.judgeResult) {
      return res.status(400).json({ success: false, error: 'judgeResult 必填' });
    }
    if (!body.operator) {
      return res.status(400).json({ success: false, error: 'operator 必填' });
    }
    const result = MaterialService.judge(id, body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }
    res.json({ success: true, data: result.material });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/rerun', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效的材料ID' });
    }
    const body = req.body as RerunRequest;
    if (!body.operator) {
      return res.status(400).json({ success: false, error: 'operator 必填' });
    }
    const result = RerunService.rerun(id, body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }
    res.json({ success: true, data: result.material, newOpinionIds: result.newOpinionIds });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import', (req: Request, res: Response) => {
  try {
    const body = req.body;
    const items = (body?.items ?? body) as ImportItem[];
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items 必须是数组' });
    }
    const operator = (body?.operator as string) || '系统';
    const result = MaterialService.importItems(items, operator);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
