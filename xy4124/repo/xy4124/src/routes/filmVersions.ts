import { Router, Request, Response } from 'express';
import { FilmVersionRepository, AuditLogRepository } from '../storage';
import { FilmVersionCreateInput, AuditAction, AuditEntityType } from '../models';

const router = Router();
const filmRepo = new FilmVersionRepository();
const auditRepo = new AuditLogRepository();

router.get('/', (req: Request, res: Response) => {
  const onlyActive = req.query.active !== 'false';
  const films = filmRepo.findAll(onlyActive);
  res.json(films);
});

router.get('/:id', (req: Request, res: Response) => {
  const film = filmRepo.findById(req.params.id);
  if (!film) {
    return res.status(404).json({ error: 'Film version not found' });
  }
  res.json(film);
});

router.get('/film/:filmId/version/:versionId', (req: Request, res: Response) => {
  const film = filmRepo.findByFilmAndVersion(req.params.filmId, req.params.versionId);
  if (!film) {
    return res.status(404).json({ error: 'Film version not found' });
  }
  res.json(film);
});

router.post('/', (req: Request, res: Response) => {
  try {
    const input: FilmVersionCreateInput = req.body;
    
    const existing = filmRepo.findByFilmAndVersion(input.filmId, input.versionId);
    if (existing) {
      return res.status(409).json({ 
        error: 'Film version already exists',
        existingId: existing.id 
      });
    }
    
    const film = filmRepo.create(input);
    
    auditRepo.create({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.FILM_VERSION,
      entityId: film.id,
      actor: req.headers['x-actor'] as string || 'api',
      actorRole: 'operator',
      success: true,
      newValues: film,
    });
    
    res.status(201).json(film);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = filmRepo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Film version not found' });
    }
    
    const updates: Partial<FilmVersionCreateInput> = req.body;
    const updated = filmRepo.update(req.params.id, updates);
    
    auditRepo.create({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.FILM_VERSION,
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
    const existing = filmRepo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Film version not found' });
    }
    
    const deactivated = filmRepo.deactivate(req.params.id);
    
    auditRepo.create({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.FILM_VERSION,
      entityId: deactivated.id,
      actor: req.headers['x-actor'] as string || 'api',
      actorRole: 'operator',
      success: true,
      oldValues: existing,
    });
    
    res.json({ message: 'Film version deactivated', film: deactivated });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export { router as filmVersionsRouter };
