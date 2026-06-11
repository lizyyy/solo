import type { Request, Response } from 'express';
import { collisionService } from '../services/CollisionService.js';
import { z } from 'zod';

const PatchSchema = z.object({
  remark: z.string().optional(),
  status: z.enum(['pending', 'processing', 'resolved', 'waived']).optional(),
  conclusion: z.string().optional(),
  isAbnormal: z.boolean().optional(),
  abnormalReason: z.string().nullable().optional(),
  changeReason: z.string().optional(),
  changedBy: z.string().min(1),
  changedByName: z.string().min(1),
});

const MaterialSchema = z.object({
  type: z.enum(['bim_note', 'boundary_sample', 'verbal_note', 'supplement']),
  content: z.string().min(1),
  uploader: z.string().min(1),
  uploaderName: z.string().min(1),
  changeReason: z.string().optional(),
});

export class CollisionController {
  static list(req: Request, res: Response) {
    const query = req.query;
    const parsed: any = {};
    if (query.floor) parsed.floor = String(query.floor);
    if (query.discipline) parsed.discipline = String(query.discipline);
    if (query.status) parsed.status = String(query.status);
    if (query.isAbnormal !== undefined) parsed.isAbnormal = query.isAbnormal === 'true';
    if (query.keyword) parsed.keyword = String(query.keyword);
    res.json(collisionService.list(parsed));
  }

  static get(req: Request, res: Response) {
    const r = collisionService.getById(req.params.id);
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r);
  }

  static patch(req: Request, res: Response) {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const r = collisionService.patch(req.params.id, parsed.data);
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r);
  }

  static listMaterials(req: Request, res: Response) {
    const r = collisionService.getMaterials(req.params.id);
    res.json(r);
  }

  static addMaterial(req: Request, res: Response) {
    const parsed = MaterialSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const r = collisionService.addMaterial({
      collisionId: req.params.id,
      ...parsed.data,
    });
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r);
  }

  static listVersions(req: Request, res: Response) {
    res.json(collisionService.getVersions(req.params.id));
  }

  static diff(req: Request, res: Response) {
    const v1 = parseInt(req.params.v1, 10);
    const v2 = parseInt(req.params.v2, 10);
    if (Number.isNaN(v1) || Number.isNaN(v2)) return res.status(400).json({ error: 'bad version' });
    const r = collisionService.getDiff(req.params.id, v1, v2);
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r);
  }
}
