import { Router } from 'express';
import { CampaignController } from '../controllers/CampaignController';

const router = Router();

router.post('/', CampaignController.createCampaign);
router.get('/', CampaignController.getAllCampaigns);
router.get('/:id', CampaignController.getCampaign);
router.post('/:id/activate', CampaignController.activateCampaign);
router.post('/:id/pause', CampaignController.pauseCampaign);
router.post('/:id/resume', CampaignController.resumeCampaign);
router.post('/:id/complete', CampaignController.completeCampaign);

export default router;
