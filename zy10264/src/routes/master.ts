import { Router, Request, Response } from 'express';
import * as masterService from '../services/master.service';

const router = Router();

router.post('/countries', (req: Request, res: Response) => {
  try {
    const { name, code } = req.body;
    const country = masterService.createCountry(name, code);
    res.json(country);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/countries', (req: Request, res: Response) => {
  res.json(masterService.listCountries());
});

router.get('/countries/:id', (req: Request, res: Response) => {
  const country = masterService.getCountry(req.params.id);
  if (!country) return res.status(404).json({ error: '国家不存在' });
  res.json(country);
});

router.post('/material-types', (req: Request, res: Response) => {
  try {
    const { country_id, name, required, validity_days } = req.body;
    const type = masterService.createMaterialType(country_id, name, required, validity_days);
    res.json(type);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/material-types', (req: Request, res: Response) => {
  const countryId = req.query.country_id as string;
  res.json(masterService.listMaterialTypes(countryId));
});

router.post('/tourists', (req: Request, res: Response) => {
  try {
    const { name, passport_number, phone, email } = req.body;
    const tourist = masterService.createTourist(name, passport_number, phone, email);
    res.json(tourist);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/tourists', (req: Request, res: Response) => {
  res.json(masterService.listTourists());
});

router.get('/tourists/:id', (req: Request, res: Response) => {
  const tourist = masterService.getTourist(req.params.id);
  if (!tourist) return res.status(404).json({ error: '游客不存在' });
  res.json(tourist);
});

export default router;
