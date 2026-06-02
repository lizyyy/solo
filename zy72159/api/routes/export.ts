import { Router } from 'express';
import { exportController } from '../controllers/exportController.js';

const router = Router();

router.get('/preview', (req, res) => exportController.preview(req, res));
router.get('/csv', (req, res) => exportController.exportCSV(req, res));
router.get('/json', (req, res) => exportController.exportJSON(req, res));

export default router;
