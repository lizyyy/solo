import express, { Request, Response } from 'express';
import RollbackAction from '../models/RollbackAction';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { requestId, status, reasonCategory } = req.query;
    const query: any = {};
    
    if (requestId) query.requestId = requestId;
    if (status) query.status = status;
    if (reasonCategory) query.reasonCategory = reasonCategory;
    
    const actions = await RollbackAction.find(query).sort({ triggerTime: -1 });
    res.json({ success: true, data: actions });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取回滚动作列表失败', error });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const action = await RollbackAction.findById(req.params.id);
    if (!action) {
      return res.status(404).json({ success: false, message: '回滚动作不存在' });
    }
    res.json({ success: true, data: action });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取回滚动作失败', error });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const action = new RollbackAction(req.body);
    await action.save();
    res.status(201).json({ success: true, data: action });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建回滚动作失败', error });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const action = await RollbackAction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!action) {
      return res.status(404).json({ success: false, message: '回滚动作不存在' });
    }
    res.json({ success: true, data: action });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新回滚动作失败', error });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const action = await RollbackAction.findByIdAndDelete(req.params.id);
    if (!action) {
      return res.status(404).json({ success: false, message: '回滚动作不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除回滚动作失败', error });
  }
});

export default router;
