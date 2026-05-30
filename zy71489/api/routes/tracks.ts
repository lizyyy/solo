import { Router } from 'express';
import {
  getTracks,
  getTrack,
  createTrack,
  updateTrack,
  deleteTrack,
} from '../controllers/TrackController.js';

const router = Router();

router.get('/', getTracks);
router.get('/:id', getTrack);
router.post('/', createTrack);
router.put('/:id', updateTrack);
router.delete('/:id', deleteTrack);

export default router;
