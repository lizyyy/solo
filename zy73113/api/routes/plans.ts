import { Router } from 'express';
import { planController } from '../controllers/planController';

const router = Router();

router.get('/', planController.getPlanList);
router.post('/', planController.createPlan);
router.get('/:id', planController.getPlanDetail);
router.put('/:id/remark', planController.updateRemark);
router.put('/:id/judgment', planController.updateJudgment);
router.put('/:id/status', planController.updateStatus);
router.post('/:id/material', planController.addMaterial);
router.get('/:id/history', planController.getHistory);
router.get('/:id/export', planController.exportPlan);

export default router;
