import { Router } from 'express';
import { recordController } from '../controllers/recordController.js';

const router = Router();

router.get('/', (req, res) => recordController.getAll(req, res));
router.get('/stats', (req, res) => recordController.getStats(req, res));
router.get('/:id', (req, res) => recordController.getById(req, res));
router.put('/:id', (req, res) => recordController.update(req, res));
router.put('/:id/status', (req, res) => recordController.updateStatus(req, res));
router.delete('/:id', (req, res) => recordController.delete(req, res));
router.delete('/clear', (req, res) => recordController.clearAll(req, res));

export default router;
