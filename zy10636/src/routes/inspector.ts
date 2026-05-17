import { Router } from 'express';
import { InspectorModel } from '../models/Inspector';

const router = Router();

router.get('/', async (req, res) => {
  const inspectors = await InspectorModel.findAll();
  res.json({ success: true, data: inspectors });
});

router.get('/:id', async (req, res) => {
  const inspector = await InspectorModel.findById(req.params.id);
  if (inspector) {
    res.json({ success: true, data: inspector });
  } else {
    res.status(404).json({ success: false, message: '巡检人员不存在' });
  }
});

export default router;
