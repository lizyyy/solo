import { Router } from 'express';
import { CollisionController } from '../controllers/CollisionController.js';

const router = Router();

router.get('/', CollisionController.list);
router.get('/:id', CollisionController.get);
router.patch('/:id', CollisionController.patch);
router.get('/:id/materials', CollisionController.listMaterials);
router.post('/:id/materials', CollisionController.addMaterial);
router.get('/:id/versions', CollisionController.listVersions);
router.get('/:id/versions/:v1/diff/:v2', CollisionController.diff);

export default router;
