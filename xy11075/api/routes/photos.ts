import express from 'express';
import { photoHashMap } from '../mock/data';

const router = express.Router();

router.post('/check', (req, res) => {
  const { hashes } = req.body;
  
  if (!Array.isArray(hashes)) {
    return res.status(400).json({ error: 'hashes 必须是数组' });
  }
  
  const results: Record<string, { storeName: string; usedAt: string } | null> = {};
  
  for (const hash of hashes) {
    const reused = photoHashMap.get(hash);
    results[hash] = reused || null;
  }
  
  res.json(results);
});

export default router;
