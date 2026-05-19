import { Router, Request, Response } from 'express';
import { PersonInChargeModel } from '../models/person-in-charge.model';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, phone, role } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const id = PersonInChargeModel.create({
      name,
      phone,
      role: role || '巡检员'
    } as any);

    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const persons = PersonInChargeModel.getAll();
    res.json({ success: true, data: persons });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const person = PersonInChargeModel.getById(parseInt(req.params.id));
    if (!person) {
      return res.status(404).json({ success: false, error: '负责人不存在' });
    }
    res.json({ success: true, data: person });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/role/:role', (req: Request, res: Response) => {
  try {
    const persons = PersonInChargeModel.getByRole(req.params.role);
    res.json({ success: true, data: persons });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
