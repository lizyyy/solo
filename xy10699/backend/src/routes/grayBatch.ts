import express, { Request, Response } from 'express';
import GrayBatch from '../models/GrayBatch';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { requestId, status } = req.query;
    const query: any = {};
    
    if (requestId) query.requestId = requestId;
    if (status) query.status = status;
    
    const batches = await GrayBatch.find(query).sort({ batchNumber: 1 });
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取灰度批次列表失败', error });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const batch = await GrayBatch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, message: '灰度批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取灰度批次失败', error });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const batch = new GrayBatch(req.body);
    await batch.save();
    res.status(201).json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建灰度批次失败', error });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const batch = await GrayBatch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!batch) {
      return res.status(404).json({ success: false, message: '灰度批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新灰度批次失败', error });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const batch = await GrayBatch.findByIdAndDelete(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, message: '灰度批次不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除灰度批次失败', error });
  }
});

export default router;
