import { Router } from 'express';
import { importController } from '../controllers/importController.js';

const router = Router();

router.post('/preview', (req, res) => importController.preview(req, res));
router.post('/import', (req, res) => importController.import(req, res));

export default router;
