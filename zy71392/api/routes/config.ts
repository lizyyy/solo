import express, { type Request, type Response } from 'express';
import configRepository from '../repositories/configRepository.js';

const router = express.Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const configs = configRepository.list();
    const obj: Record<string, unknown> = {};
    configs.forEach(c => { obj[c.key] = c.value; });
    res.json({ success: true, data: obj });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/', (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    if (!key || !value) {
      res.status(400).json({ success: false, error: 'key 和 value 不能为空' });
      return;
    }
    configRepository.set(key, value);
    res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
