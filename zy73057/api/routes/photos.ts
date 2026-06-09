import { Router, type Request, type Response } from 'express';
import { store } from '../data/store.js';
import type { MaintenancePhoto } from '../../shared/types.js';

const router = Router();

router.post('/', (req: Request, res: Response): void => {
  const { itemId, batchId, url, uploadedBy, supplementaryNote, isSupplementary = false } =
    req.body ?? {};

  if (!itemId || !batchId || !url || !uploadedBy) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: itemId, batchId, url, uploadedBy',
    });
    return;
  }

  const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const photo: MaintenancePhoto = {
    id,
    itemId,
    batchId,
    url,
    uploadedAt: now,
    uploadedBy,
    supplementaryNote,
    isSupplementary: Boolean(isSupplementary),
  };

  store.photos.push(photo);

  const item = store.items.find((it) => it.id === itemId);
  if (item && !item.photoIds.includes(id)) {
    item.photoIds.push(id);
  }

  res.status(201).json({
    success: true,
    data: photo,
  });
});

router.get('/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const photo = store.photos.find((p) => p.id === id);

  if (!photo) {
    res.status(404).json({
      success: false,
      error: 'Photo not found',
    });
    return;
  }

  res.json({
    success: true,
    data: photo,
  });
});

export default router;
