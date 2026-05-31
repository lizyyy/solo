import { Router } from 'express';
import {
  getClips,
  getClip,
  postClip,
  putClip,
  patchClipStatus,
  getChangeLogs,
  getMaterials,
  postMaterial,
  getExportCheck,
  postExport,
  getUsers,
} from '../controllers/clipController';

const router = Router();

router.get('/clips', getClips);
router.get('/clips/:id', getClip);
router.post('/clips', postClip);
router.put('/clips/:id', putClip);
router.patch('/clips/:id/status', patchClipStatus);
router.get('/clips/:id/changelogs', getChangeLogs);
router.get('/clips/:id/materials', getMaterials);
router.post('/clips/:id/materials', postMaterial);

router.get('/export/check', getExportCheck);
router.post('/export', postExport);

router.get('/users', getUsers);

export default router;
