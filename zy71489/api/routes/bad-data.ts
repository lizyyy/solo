import { Router } from 'express';
import { getBadData } from '../controllers/BadDataController.js';

const router = Router();

router.get('/', getBadData);

export default router;
