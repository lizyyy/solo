import { Router } from 'express';
import * as activityController from '../controllers/activity.controller';

const router = Router();

router.post('/', activityController.createActivity);
router.get('/', activityController.listActivities);
router.get('/:id', activityController.getActivity);
router.put('/:id', activityController.updateActivity);
router.delete('/:id', activityController.deleteActivity);

export default router;
