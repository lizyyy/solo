import { Router } from 'express';
import VersionController from '../controllers/VersionController';

const router = Router({ mergeParams: true });

router.get('/', VersionController.getSetlistVersions);
router.get('/songs/:songId', VersionController.getSongVersions);
router.get('/songs/:songId/fields/:field', VersionController.getSongFieldVersions);

export default router;
