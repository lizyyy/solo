import express, { Request, Response } from 'express';
import AffectedService from '../models/AffectedService';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { requestId, environment, impactLevel, status } = req.query;
    const query: any = {};
    
    if (requestId) query.requestId = requestId;
    if (environment) query.environment = environment;
    if (impactLevel) query.impactLevel = impactLevel;
    if (status) query.status = status;
    
    const services = await AffectedService.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取影响服务列表失败', error });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const service = await AffectedService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: '影响服务不存在' });
    }
    res.json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取影响服务失败', error });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const service = new AffectedService(req.body);
    await service.save();
    res.status(201).json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建影响服务失败', error });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { modifiedBy, ...updateData } = req.body;
    const oldService = await AffectedService.findById(req.params.id);
    
    if (!oldService) {
      return res.status(404).json({ success: false, message: '影响服务不存在' });
    }
    
    const changeHistory = [];
    for (const key of Object.keys(updateData)) {
      if (oldService.get(key) !== updateData[key]) {
        changeHistory.push({
          field: key,
          oldValue: oldService.get(key),
          newValue: updateData[key],
          modifiedBy: modifiedBy || 'system',
          modifiedAt: new Date()
        });
      }
    }
    
    const service = await AffectedService.findByIdAndUpdate(
      req.params.id,
      { $set: updateData, $push: { changeHistory: { $each: changeHistory } } },
      { new: true }
    );
    
    res.json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新影响服务失败', error });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const service = await AffectedService.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: '影响服务不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除影响服务失败', error });
  }
});

export default router;
