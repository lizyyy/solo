import { Router, Request, Response } from 'express';
import { AuditoriumDeviceRepository, AuditLogRepository } from '../storage';
import { AuditoriumDeviceCreateInput, AuditAction, AuditEntityType } from '../models';

const router = Router();
const auditoriumRepo = new AuditoriumDeviceRepository();
const auditRepo = new AuditLogRepository();

router.get('/', (req: Request, res: Response) => {
  const onlyActive = req.query.active !== 'false';
  const auditoriums = auditoriumRepo.findAll(onlyActive);
  res.json(auditoriums);
});

router.get('/:id', (req: Request, res: Response) => {
  const auditorium = auditoriumRepo.findById(req.params.id);
  if (!auditorium) {
    return res.status(404).json({ error: 'Auditorium not found' });
  }
  res.json(auditorium);
});

router.get('/auditoriumId/:auditoriumId', (req: Request, res: Response) => {
  const auditorium = auditoriumRepo.findByAuditoriumId(req.params.auditoriumId);
  if (!auditorium) {
    return res.status(404).json({ error: 'Auditorium not found' });
  }
  res.json(auditorium);
});

router.post('/', (req: Request, res: Response) => {
  try {
    const input: AuditoriumDeviceCreateInput = req.body;
    
    const existing = auditoriumRepo.findByAuditoriumId(input.auditoriumId);
    if (existing) {
      return res.status(409).json({ 
        error: 'Auditorium already exists',
        existingId: existing.id 
      });
    }
    
    const auditorium = auditoriumRepo.create(input);
    
    auditRepo.create({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.AUDITORIUM_DEVICE,
      entityId: auditorium.id,
      actor: req.headers['x-actor'] as string || 'api',
      actorRole: 'operator',
      success: true,
      newValues: auditorium,
    });
    
    res.status(201).json(auditorium);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = auditoriumRepo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Auditorium not found' });
    }
    
    const updates: Partial<AuditoriumDeviceCreateInput> = req.body;
    const updated = auditoriumRepo.update(req.params.id, updates);
    
    auditRepo.create({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.AUDITORIUM_DEVICE,
      entityId: updated.id,
      actor: req.headers['x-actor'] as string || 'api',
      actorRole: 'operator',
      success: true,
      oldValues: existing,
      newValues: updated,
    });
    
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = auditoriumRepo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Auditorium not found' });
    }
    
    const deactivated = auditoriumRepo.deactivate(req.params.id);
    
    auditRepo.create({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.AUDITORIUM_DEVICE,
      entityId: deactivated.id,
      actor: req.headers['x-actor'] as string || 'api',
      actorRole: 'operator',
      success: true,
      oldValues: existing,
    });
    
    res.json({ message: 'Auditorium deactivated', auditorium: deactivated });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export { router as auditoriumsRouter };
