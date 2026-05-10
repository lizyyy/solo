import { Router, Request, Response } from 'express';
import { SalesPersonModel } from '../models/SalesPerson';
import { ISalesPerson } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const salesPeople = await SalesPersonModel.find().sort({ name: 1 }).lean();
    res.json({ success: true, data: salesPeople });
  } catch (error) {
    console.error('获取销售人员列表失败:', error);
    res.status(500).json({ error: '获取销售人员列表失败' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const salesPerson = await SalesPersonModel.findOne({ id: req.params.id }).lean();
    
    if (!salesPerson) {
      return res.status(404).json({ error: '销售人员不存在' });
    }

    res.json({ success: true, data: salesPerson });
  } catch (error) {
    console.error('获取销售人员详情失败:', error);
    res.status(500).json({ error: '获取销售人员详情失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, regions, productExpertise, maxLoad } = req.body;
    
    if (!name || !email || !phone) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const newSalesPerson: Partial<ISalesPerson> = {
      id: uuidv4(),
      name,
      email,
      phone,
      regions: regions || [],
      productExpertise: productExpertise || [],
      maxLoad: maxLoad || 10,
      currentLoad: 0,
      isOnVacation: false,
      stats: {
        pending: 0,
        following: 0,
        converted: 0,
        rejected: 0,
        total: 0
      }
    };

    const created = await SalesPersonModel.create(newSalesPerson);
    res.json({ success: true, data: created.toObject() });
  } catch (error) {
    console.error('创建销售人员失败:', error);
    res.status(500).json({ error: '创建销售人员失败' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, regions, productExpertise, maxLoad, isOnVacation } = req.body;
    
    const update: any = {};
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (regions !== undefined) update.regions = regions;
    if (productExpertise !== undefined) update.productExpertise = productExpertise;
    if (maxLoad !== undefined) update.maxLoad = maxLoad;
    if (isOnVacation !== undefined) update.isOnVacation = isOnVacation;

    const updated = await SalesPersonModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: '销售人员不存在' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('更新销售人员失败:', error);
    res.status(500).json({ error: '更新销售人员失败' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await SalesPersonModel.deleteOne({ id: req.params.id });
    
    if (deleted.deletedCount === 0) {
      return res.status(404).json({ error: '销售人员不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('删除销售人员失败:', error);
    res.status(500).json({ error: '删除销售人员失败' });
  }
});

export default router;
