import express from 'express';
import * as service from '../services/listVersionService';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, description, version, createdBy } = req.body;
    if (!name || !version || !createdBy) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const result = await service.createListVersion(name, description || '', version, createdBy);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const status = req.query.status as 'active' | 'archived' | undefined;
    const result = await service.getAllListVersions(status);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await service.getListVersionById(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '名单版本不存在' });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const { actor } = req.body;
    if (!actor) {
      return res.status(400).json({ error: '缺少操作人信息' });
    }
    const result = await service.archiveListVersion(req.params.id, actor);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
