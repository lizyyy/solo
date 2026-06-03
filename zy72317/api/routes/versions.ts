import { Router } from 'express';
import { versionController } from '../controllers/VersionController';

const router = Router();

router.get('/', versionController.getVersions);
router.get('/latest', versionController.getLatestVersion);
router.get('/can-publish', versionController.canPublish);
router.get('/:id', versionController.getVersionById);
router.post('/', versionController.createVersion);
router.post('/:id/publish', versionController.publishVersion);

export default router;
