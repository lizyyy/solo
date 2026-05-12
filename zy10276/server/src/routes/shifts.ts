import express from 'express';
import ShiftDAO from '../dao/shift.dao';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const shifts = ShiftDAO.getAll();
    res.json({ success: true, data: shifts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/vehicle/:vehicleId', async (req, res) => {
  try {
    const shifts = ShiftDAO.getByVehicleId(req.params.vehicleId);
    res.json({ success: true, data: shifts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const shift = ShiftDAO.create(req.body);
    res.json({ success: true, data: shift, message: '班次创建成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const shift = ShiftDAO.update(req.params.id, req.body);
    if (!shift) {
      return res.status(404).json({ success: false, error: '班次不存在' });
    }
    res.json({ success: true, data: shift, message: '班次更新成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = ShiftDAO.delete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: '班次不存在' });
    }
    res.json({ success: true, message: '班次已删除' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
