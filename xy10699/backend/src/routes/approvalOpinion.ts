import express, { Request, Response } from 'express';
import ApprovalOpinion from '../models/ApprovalOpinion';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { requestId, approver, opinion } = req.query;
    const query: any = {};
    
    if (requestId) query.requestId = requestId;
    if (approver) query.approver = approver;
    if (opinion) query.opinion = opinion;
    
    const opinions = await ApprovalOpinion.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: opinions });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取审批意见列表失败', error });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const opinion = await ApprovalOpinion.findById(req.params.id);
    if (!opinion) {
      return res.status(404).json({ success: false, message: '审批意见不存在' });
    }
    res.json({ success: true, data: opinion });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取审批意见失败', error });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const opinion = new ApprovalOpinion(req.body);
    await opinion.save();
    res.status(201).json({ success: true, data: opinion });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建审批意见失败', error });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { modifiedBy, ...updateData } = req.body;
    const oldOpinion = await ApprovalOpinion.findById(req.params.id);
    
    if (!oldOpinion) {
      return res.status(404).json({ success: false, message: '审批意见不存在' });
    }
    
    const changeHistory = [];
    for (const key of Object.keys(updateData)) {
      if (oldOpinion.get(key) !== updateData[key]) {
        changeHistory.push({
          field: key,
          oldValue: oldOpinion.get(key),
          newValue: updateData[key],
          modifiedBy: modifiedBy || 'system',
          modifiedAt: new Date()
        });
      }
    }
    
    const opinion = await ApprovalOpinion.findByIdAndUpdate(
      req.params.id,
      { $set: updateData, $push: { changeHistory: { $each: changeHistory } } },
      { new: true }
    );
    
    res.json({ success: true, data: opinion });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新审批意见失败', error });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const opinion = await ApprovalOpinion.findByIdAndDelete(req.params.id);
    if (!opinion) {
      return res.status(404).json({ success: false, message: '审批意见不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除审批意见失败', error });
  }
});

export default router;
