import { Router, Request, Response } from 'express';
import { KDMRepository, AuditLogRepository } from '../storage';
import { KDMCreateInput, AuditAction, AuditEntityType } from '../models';

const router = Router();
const kdmRepo = new KDMRepository();
const auditRepo = new AuditLogRepository();

router.get('/', (req: Request, res: Response) => {
  const onlyActive = req.query.active !== 'false';
  const kdms = kdmRepo.findAll(onlyActive);
  res.json(kdms);
});

router.get('/:id', (req: Request, res: Response) => {
  const kdm = kdmRepo.findById(req.params.id);
  if (!kdm) {
    return res.status(404).json({ error: 'KDM not found' });
  }
  res.json(kdm);
});

router.get('/kdmId/:kdmId', (req: Request, res: Response) => {
  const kdm = kdmRepo.findByKDMId(req.params.kdmId);
  if (!kdm) {
    return res.status(404).json({ error: 'KDM not found' });
  }
  res.json(kdm);
});

router.get('/film/:filmId/version/:versionId/auditorium/:auditoriumId', (req: Request, res: Response) => {
  const kdms = kdmRepo.findByFilmVersionAuditorium(
    req.params.filmId,
    req.params.versionId,
    req.params.auditoriumId
  );
  res.json(kdms);
});

router.post('/', (req: Request, res: Response) => {
  try {
    const input: KDMCreateInput = req.body;
    
    const existing = kdmRepo.findByKDMId(input.kdmId);
    if (existing) {
      return res.status(409).json({ 
        error: 'KDM already exists',
        existingId: existing.id 
      });
    }
    
    const kdm = kdmRepo.create(input);
    
    auditRepo.create({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.KDM,
      entityId: kdm.id,
      actor: req.headers['x-actor'] as string || 'api',
      actorRole: 'operator',
      success: true,
      newValues: kdm,
    });
    
    res.status(201).json(kdm);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = kdmRepo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'KDM not found' });
    }
    
    const deactivated = kdmRepo.deactivate(req.params.id);
    
    auditRepo.create({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.KDM,
      entityId: deactivated.id,
      actor: req.headers['x-actor'] as string || 'api',
      actorRole: 'operator',
      success: true,
      oldValues: existing,
    });
    
    res.json({ message: 'KDM deactivated', kdm: deactivated });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export { router as kdmsRouter };
