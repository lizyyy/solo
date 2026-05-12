import express from 'express';
import DriverDAO from '../dao/driver.dao';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const drivers = DriverDAO.getAll();
    res.json({ success: true, data: drivers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const driver = DriverDAO.getById(req.params.id);
    if (!driver) {
      return res.status(404).json({ success: false, error: '司机不存在' });
    }
    res.json({ success: true, data: driver });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const driver = DriverDAO.create(req.body);
    res.json({ success: true, data: driver, message: '司机创建成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const driver = DriverDAO.update(req.params.id, req.body);
    if (!driver) {
      return res.status(404).json({ success: false, error: '司机不存在' });
    }
    res.json({ success: true, data: driver, message: '司机信息更新成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = DriverDAO.delete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: '司机不存在' });
    }
    res.json({ success: true, message: '司机已删除' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
