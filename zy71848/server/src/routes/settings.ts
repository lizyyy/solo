import { Router, Request, Response } from 'express';
import { dataStore } from '../dataStore';
import type { ApiResponse, AppSettings } from '../../../shared/types';

const router = Router();

router.get('/', (req: Request, res: Response<ApiResponse<AppSettings>>) => {
  try {
    const settings = dataStore.getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取配置失败' });
  }
});

router.put('/', (req: Request<unknown, unknown, Partial<AppSettings>>, res: Response<ApiResponse<AppSettings>>) => {
  try {
    const settings = req.body;
    const updated = dataStore.updateSettings(settings);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: '更新配置失败' });
  }
});

export default router;
