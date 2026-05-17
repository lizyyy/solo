import { Router } from 'express';
import {
  createArbitration,
  getArbitrationById,
  getArbitrations,
  updateArbitrationStatus,
  addCorrection,
  exportArbitrations,
  getStatusStats
} from '../controllers/arbitrationController';
import {
  validateCreateArbitration,
  validateUpdateStatus,
  validateCorrection,
  validateQuery
} from '../middleware/validation';

const router = Router();

router.post('/', validateCreateArbitration, createArbitration);
router.get('/stats', getStatusStats);
router.get('/export', exportArbitrations);
router.get('/:id', getArbitrationById);
router.get('/', validateQuery, getArbitrations);
router.patch('/:id/status', validateUpdateStatus, updateArbitrationStatus);
router.patch('/:id/correction', validateCorrection, addCorrection);

export default router;
