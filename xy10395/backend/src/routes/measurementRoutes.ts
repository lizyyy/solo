import { Router } from 'express';
import { getMeasurements, createMeasurement } from '../controllers/measurementController';

const router = Router();

router.get('/', getMeasurements);
router.post('/', createMeasurement);

export default router;
