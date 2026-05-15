import { Router } from 'express';
import * as securityController from '../controllers/security.controller';

const router = Router();

router.post('/', securityController.createCandidateList);
router.get('/', securityController.getCandidateLists);
router.put('/:id/approve', securityController.approveCandidateList);
router.post('/:id/execute', securityController.executeCandidateList);

export default router;
