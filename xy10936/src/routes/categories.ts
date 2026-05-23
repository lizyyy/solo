import { Router, Request, Response } from 'express';
import * as categoryDao from '../dao/categoryDao';
import * as priceDao from '../dao/priceDao';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: '品类名称和代码不能为空' });
    }
    const id = await categoryDao.createCategory({ name, code, description });
    res.status(201).json({ id, name, code, description });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await categoryDao.getAllCategories();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const category = await categoryDao.getCategoryById(id);
    if (!category) {
      return res.status(404).json({ error: '品类不存在' });
    }
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/prices', async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { price, effective_date, created_by } = req.body;
    if (!price || !effective_date) {
      return res.status(400).json({ error: '价格和生效日期不能为空' });
    }
    const id = await priceDao.createPriceVersion({
      category_id: categoryId,
      price,
      effective_date,
      created_by
    });
    res.status(201).json({ id, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/prices', async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    const prices = await priceDao.getPriceVersionsByCategory(categoryId);
    res.json(prices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/deductions', async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { ratio, description } = req.body;
    if (ratio === undefined) {
      return res.status(400).json({ error: '扣杂比例不能为空' });
    }
    const id = await priceDao.createDeductionRatio({
      category_id: categoryId,
      ratio,
      description
    });
    res.status(201).json({ id, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/deductions/all', async (req: Request, res: Response) => {
  try {
    const deductions = await priceDao.getAllDeductionRatios();
    res.json(deductions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
