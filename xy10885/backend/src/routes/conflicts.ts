import express from 'express';
import * as conflictService from '../services/conflict.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await conflictService.getConflicts(req.query);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const conflict = await conflictService.getConflictById(req.params.id);
    if (!conflict) {
      return res.status(404).json({ success: false, error: '冲突记录不存在' });
    }
    res.json({ success: true, data: conflict });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const conflict = await conflictService.resolveConflict(req.params.id, req.body);
    res.json({ success: true, data: conflict });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
