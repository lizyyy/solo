import { Router } from 'express';
import * as photoController from '../controllers/photoController';

const router = Router();

router.get('/:projectId', photoController.getPhotos);
router.post('/:projectId', photoController.uploadPhoto);
router.delete('/:id', photoController.deletePhoto);

export default router;
