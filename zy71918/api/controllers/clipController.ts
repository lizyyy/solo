import type { Request, Response } from 'express';
import type { ClipStatus } from '../../shared/types';
import {
  getAllClips,
  getClipById,
  createClip,
  updateClip,
  updateClipStatus,
  getClipChangeLogs,
  getClipMaterials,
  addMaterial,
  checkExport,
  exportManifest,
  getAllUsers,
} from '../services/clipService';

export function getClips(req: Request, res: Response): void {
  const { status, keyword } = req.query;

  const filters: { status?: ClipStatus; keyword?: string } = {};
  if (status && typeof status === 'string') {
    filters.status = status as ClipStatus;
  }
  if (keyword && typeof keyword === 'string') {
    filters.keyword = keyword;
  }

  const clips = getAllClips(filters);
  res.json(clips);
}

export function getClip(req: Request, res: Response): void {
  const { id } = req.params;
  const clip = getClipById(id);

  if (!clip) {
    res.status(404).json({ error: 'Clip not found' });
    return;
  }

  res.json(clip);
}

export function postClip(req: Request, res: Response): void {
  try {
    const clip = createClip(req.body);
    res.status(201).json(clip);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export function putClip(req: Request, res: Response): void {
  const { id } = req.params;

  try {
    const clip = updateClip(id, req.body);
    if (!clip) {
      res.status(404).json({ error: 'Clip not found' });
      return;
    }
    res.json(clip);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export function patchClipStatus(req: Request, res: Response): void {
  const { id } = req.params;

  try {
    const clip = updateClipStatus(id, req.body);
    if (!clip) {
      res.status(404).json({ error: 'Clip not found or invalid status transition' });
      return;
    }
    res.json(clip);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export function getChangeLogs(req: Request, res: Response): void {
  const { id } = req.params;
  const changeLogs = getClipChangeLogs(id);

  if (!changeLogs) {
    res.status(404).json({ error: 'Clip not found' });
    return;
  }

  res.json(changeLogs);
}

export function getMaterials(req: Request, res: Response): void {
  const { id } = req.params;
  const materials = getClipMaterials(id);

  if (!materials) {
    res.status(404).json({ error: 'Clip not found' });
    return;
  }

  res.json(materials);
}

export function postMaterial(req: Request, res: Response): void {
  const { id } = req.params;

  try {
    const material = addMaterial(id, req.body);
    if (!material) {
      res.status(404).json({ error: 'Clip not found' });
      return;
    }
    res.status(201).json(material);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export function getExportCheck(req: Request, res: Response): void {
  const { clipIds, operatorId } = req.query;

  if (!clipIds || !operatorId || typeof clipIds !== 'string' || typeof operatorId !== 'string') {
    res.status(400).json({ error: 'clipIds and operatorId are required' });
    return;
  }

  const ids = clipIds.split(',');
  const manifest = checkExport(ids, operatorId);

  if (!manifest) {
    res.status(404).json({ error: 'Invalid operator' });
    return;
  }

  res.json(manifest);
}

export function postExport(req: Request, res: Response): void {
  const { clipIds, operatorId } = req.body;

  if (!Array.isArray(clipIds) || !operatorId) {
    res.status(400).json({ error: 'clipIds (array) and operatorId are required' });
    return;
  }

  const result = exportManifest(clipIds, operatorId);
  if (!result) {
    res.status(404).json({ error: 'Invalid operator' });
    return;
  }

  res.json(result);
}

export function getUsers(req: Request, res: Response): void {
  const users = getAllUsers();
  res.json(users);
}
