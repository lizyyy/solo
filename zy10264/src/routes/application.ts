import { Router, Request, Response } from 'express';
import * as applicationService from '../services/application.service';
import * as materialService from '../services/material.service';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { tourist_id, country_id } = req.body;
    const application = applicationService.createApplication(tourist_id, country_id);
    res.json(application);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/', (req: Request, res: Response) => {
  const filters = {
    tourist_id: req.query.tourist_id as string,
    country_id: req.query.country_id as string,
    status: req.query.status as string
  };
  res.json(applicationService.listApplications(filters));
});

router.get('/:id', (req: Request, res: Response) => {
  const app = applicationService.getApplication(req.params.id);
  if (!app) return res.status(404).json({ error: '申请不存在' });
  res.json(app);
});

router.get('/:id/materials', (req: Request, res: Response) => {
  const materials = applicationService.getApplicationMaterials(req.params.id);
  res.json(materials);
});

router.get('/:id/missing-materials', (req: Request, res: Response) => {
  try {
    const missing = applicationService.getMissingMaterials(req.params.id);
    res.json(missing);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id/history', (req: Request, res: Response) => {
  const history = applicationService.getApplicationStatusHistory(req.params.id);
  res.json(history);
});

router.post('/:id/submit', (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const app = applicationService.submitApplication(req.params.id, operator);
    res.json(app);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/start-review', (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const app = applicationService.startReview(req.params.id, operator);
    res.json(app);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/send', (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const app = applicationService.sendToVisa(req.params.id, operator);
    res.json(app);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/return', (req: Request, res: Response) => {
  try {
    const { reason, operator } = req.body;
    const app = applicationService.returnApplication(req.params.id, reason, operator);
    res.json(app);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/supplement', (req: Request, res: Response) => {
  try {
    const { material_id, reason, operator } = req.body;
    const result = applicationService.requestSupplement(req.params.id, material_id, reason, operator);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/close', (req: Request, res: Response) => {
  try {
    const { reason, operator } = req.body;
    const app = applicationService.closeApplication(req.params.id, reason, operator);
    res.json(app);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/materials', (req: Request, res: Response) => {
  try {
    const { type_id, file_url, expire_at, remark } = req.body;
    const material = materialService.uploadMaterial(req.params.id, type_id, file_url, expire_at, remark);
    res.json(material);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/materials/:id/review', (req: Request, res: Response) => {
  try {
    const { status, reviewer_note } = req.body;
    const material = materialService.reviewMaterial(req.params.id, status, reviewer_note);
    res.json(material);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id/materials/:type_id/versions', (req: Request, res: Response) => {
  const versions = materialService.getMaterialVersions(req.params.id, req.params.type_id);
  res.json(versions);
});

router.get('/supplement-requests', (req: Request, res: Response) => {
  const applicationId = req.query.application_id as string;
  const requests = materialService.getSupplementRequests(applicationId);
  res.json(requests);
});

export default router;
