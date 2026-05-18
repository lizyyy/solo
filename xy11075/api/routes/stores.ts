import express from 'express';
import { mockStores } from '../mock/data';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(mockStores);
});

router.get('/:id', (req, res) => {
  const store = mockStores.find(s => s.id === req.params.id);
  if (!store) {
    return res.status(404).json({ error: '门店不存在' });
  }
  res.json(store);
});

export default router;
