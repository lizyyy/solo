import { Router } from 'express';
import * as projectController from '../controllers/projectController';

const router = Router();

router.get('/', projectController.getProjects);
router.get('/status-transitions', projectController.getStatusTransitions);
router.get('/:id', projectController.getProjectById);
router.post('/', projectController.createProject);
router.put('/:id', projectController.updateProject);
router.post('/:id/transition-status', projectController.transitionStatus);

export default router;
