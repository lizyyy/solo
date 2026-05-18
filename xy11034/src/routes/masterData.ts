import { Router, Request, Response } from 'express';
import { store } from '../data/store';

const router = Router();

router.get('/green-coffees', (req: Request, res: Response) => {
  const coffees = store.getAllGreenCoffees();
  res.json({
    success: true,
    data: coffees,
    timestamp: new Date()
  });
});

router.get('/roasting-curves', (req: Request, res: Response) => {
  const curves = store.getAllRoastingCurves();
  res.json({
    success: true,
    data: curves,
    timestamp: new Date()
  });
});

export default router;
