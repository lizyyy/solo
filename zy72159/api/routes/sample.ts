import { Router } from 'express';
import { sampleController } from '../controllers/sampleController.js';

const router = Router();

router.post('/load', (req, res) => sampleController.loadSample(req, res));
router.get('/raw', (req, res) => sampleController.getSampleRaw(req, res));

export default router;
