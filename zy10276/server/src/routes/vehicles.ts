import express from 'express';
import VehicleDAO from '../dao/vehicle.dao';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const vehicles = VehicleDAO.getAll();
    res.json({ success: true, data: vehicles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const vehicle = VehicleDAO.getById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ success: false, error: '车辆不存在' });
    }
    res.json({ success: true, data: vehicle });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const vehicle = VehicleDAO.create(req.body);
    res.json({ success: true, data: vehicle, message: '车辆创建成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const vehicle = VehicleDAO.update(req.params.id, req.body);
    if (!vehicle) {
      return res.status(404).json({ success: false, error: '车辆不存在' });
    }
    res.json({ success: true, data: vehicle, message: '车辆信息更新成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = VehicleDAO.delete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: '车辆不存在' });
    }
    res.json({ success: true, message: '车辆已删除' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
