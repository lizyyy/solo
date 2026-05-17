import { Router } from 'express';
import { DeviceModel } from '../models/Device';

const router = Router();

router.get('/', async (req, res) => {
  const devices = await DeviceModel.findAll();
  res.json({ success: true, data: devices });
});

router.get('/:id', async (req, res) => {
  const device = await DeviceModel.findById(req.params.id);
  if (device) {
    res.json({ success: true, data: device });
  } else {
    res.status(404).json({ success: false, message: '设备不存在' });
  }
});

export default router;
