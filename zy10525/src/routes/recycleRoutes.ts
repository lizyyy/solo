import { Router } from 'express';
import * as controller from '../controllers/recycleController';
import {
  validateCreateRecycle,
  validateQueryRecycle,
  validateStatusTransition,
  validateExceptionHandle,
  validateManualCorrection
} from '../middleware/validation';

const router = Router();

router.post('/', validateCreateRecycle, controller.createRecycle);

router.get('/export', controller.exportRecycle);

router.get('/:id', controller.getRecycleById);

router.get('/', validateQueryRecycle, controller.queryRecycle);

router.patch('/:id/status', validateStatusTransition, controller.transitionStatus);

router.patch('/:id/exceptions/:exceptionId/handle', validateExceptionHandle, controller.handleException);

router.patch('/:id/manual-correction', validateManualCorrection, controller.manualCorrection);

router.patch('/:id/hit-tenants', controller.updateHitTenants);

router.post('/check-expirations', controller.triggerExpirationCheck);

router.post('/send-reminders', controller.triggerReminders);

export default router;
