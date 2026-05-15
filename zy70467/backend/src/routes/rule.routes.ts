import { Router } from 'express';
import * as ruleController from '../controllers/rule.controller';

const router = Router();

router.post('/', ruleController.createRuleVersion);
router.get('/', ruleController.getAllRules);
router.get('/active', ruleController.getActiveRule);
router.get('/:id', ruleController.getRuleById);
router.put('/:id/status', ruleController.toggleRuleStatus);

export default router;
