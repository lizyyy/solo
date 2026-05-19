import { Router, Request, Response } from 'express';
import { PumpRoomModel } from '../models/pump-room.model';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, location, building, equipment_count } = req.body;

    if (!name || !location) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const id = PumpRoomModel.create({
      name,
      location,
      building,
      equipment_count: equipment_count || 0,
      status: '正常'
    } as any);

    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const pumpRooms = PumpRoomModel.getAll();
    res.json({ success: true, data: pumpRooms });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const pumpRoom = PumpRoomModel.getById(parseInt(req.params.id));
    if (!pumpRoom) {
      return res.status(404).json({ success: false, error: '泵房不存在' });
    }
    res.json({ success: true, data: pumpRoom });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
