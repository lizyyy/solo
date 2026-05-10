import { Router } from 'express';
import { MaterialBindingController } from '../controllers/MaterialBindingController';

const router = Router();

router.post('/', MaterialBindingController.bindMaterial);
router.get('/:id', MaterialBindingController.getBinding);
router.get('/campaign/:campaignId', MaterialBindingController.getBindingsByCampaign);
router.get('/campaign/:campaignId/channel/:channelId/active', MaterialBindingController.getActiveBindings);
router.post('/:id/unbind', MaterialBindingController.unbindMaterial);
router.post('/:id/pause', MaterialBindingController.pauseBinding);
router.post('/:id/resume', MaterialBindingController.resumeBinding);
router.put('/:id/allocation', MaterialBindingController.updateAllocatedBudget);

export default router;
