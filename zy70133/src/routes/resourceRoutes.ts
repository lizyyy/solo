import { Router } from 'express';
import { ResourceController } from '../controllers/ResourceController';

const router = Router();

router.post('/materials', ResourceController.createMaterial);
router.get('/materials', ResourceController.getAllMaterials);
router.get('/materials/:id', ResourceController.getMaterial);
router.post('/materials/:id/approve', ResourceController.approveMaterial);
router.post('/materials/:id/reject', ResourceController.rejectMaterial);

router.post('/channels', ResourceController.createChannel);
router.get('/channels', ResourceController.getAllChannels);
router.get('/channels/:id', ResourceController.getChannel);

export default router;
