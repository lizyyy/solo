import { Router, Request, Response } from 'express';
import { transferService } from '../services/TransferService';
import { Teller, ScheduleEntry } from '../types';

const router = Router();

router.get('/tellers', async (req: Request, res: Response) => {
  try {
    const tellers = await transferService.getTellers();
    res.status(200).json(tellers);
  } catch (error) {
    res.status(500).json({ error: '获取柜员列表失败' });
  }
});

router.post('/tellers', async (req: Request, res: Response) => {
  try {
    const tellers = req.body as Teller[];
    await transferService.saveTellers(tellers);
    res.status(200).json({ message: `保存 ${tellers.length} 条柜员信息成功` });
  } catch (error) {
    res.status(500).json({ error: '保存柜员信息失败' });
  }
});

router.get('/schedules', async (req: Request, res: Response) => {
  try {
    const schedules = await transferService.getSchedules();
    res.status(200).json(schedules);
  } catch (error) {
    res.status(500).json({ error: '获取排班列表失败' });
  }
});

router.post('/schedules', async (req: Request, res: Response) => {
  try {
    const schedules = req.body as ScheduleEntry[];
    await transferService.saveSchedules(schedules);
    res.status(200).json({ message: `保存 ${schedules.length} 条排班信息成功` });
  } catch (error) {
    res.status(500).json({ error: '保存排班信息失败' });
  }
});

export default router;
