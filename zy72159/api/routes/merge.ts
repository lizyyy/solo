import { Router } from 'express';
import { mergeController } from '../controllers/mergeController.js';

const router = Router();

router.get('/candidates', (req, res) => mergeController.getCandidates(req, res));
router.get('/conflicts', (req, res) => mergeController.getConflicts(req, res));
router.post('/auto', (req, res) => mergeController.autoMerge(req, res));
router.post('/manual', (req, res) => mergeController.manualMerge(req, res));

export default router;
