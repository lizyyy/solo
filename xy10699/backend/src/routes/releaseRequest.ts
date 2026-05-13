import express, { Request, Response } from 'express';
import ReleaseRequest from '../models/ReleaseRequest';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, priority, type, applicant, search, page = '1', limit = '10' } = req.query;
    const query: any = {};
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;
    if (applicant) query.applicant = applicant;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { requestId: { $regex: search, $options: 'i' } }
      ];
    }
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    const requests = await ReleaseRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    const total = await ReleaseRequest.countDocuments(query);
    
    res.json({
      success: true,
      data: requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取发布申请列表失败', error });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const request = await ReleaseRequest.findOne({ requestId: req.params.id });
    if (!request) {
      return res.status(404).json({ success: false, message: '发布申请不存在' });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取发布申请失败', error });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const count = await ReleaseRequest.countDocuments();
    const requestId = `REQ${String(count + 1).padStart(6, '0')}`;
    const request = new ReleaseRequest({ ...req.body, requestId });
    await request.save();
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建发布申请失败', error });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { modifiedBy, ...updateData } = req.body;
    const oldRequest = await ReleaseRequest.findOne({ requestId: req.params.id });
    
    if (!oldRequest) {
      return res.status(404).json({ success: false, message: '发布申请不存在' });
    }
    
    const changeHistory = [];
    for (const key of Object.keys(updateData)) {
      if (oldRequest.get(key) !== updateData[key]) {
        changeHistory.push({
          field: key,
          oldValue: oldRequest.get(key),
          newValue: updateData[key],
          modifiedBy: modifiedBy || 'system',
          modifiedAt: new Date()
        });
      }
    }
    
    const request = await ReleaseRequest.findOneAndUpdate(
      { requestId: req.params.id },
      { $set: updateData, $push: { changeHistory: { $each: changeHistory } } },
      { new: true }
    );
    
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新发布申请失败', error });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const request = await ReleaseRequest.findOneAndDelete({ requestId: req.params.id });
    if (!request) {
      return res.status(404).json({ success: false, message: '发布申请不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除发布申请失败', error });
  }
});

export default router;
