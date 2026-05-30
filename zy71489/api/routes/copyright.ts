import { Router } from 'express';
import { getCopyrights, getCopyrightByTrack } from '../controllers/CopyrightController.js';

const router = Router();

router.get('/', getCopyrights);
router.get('/track/:trackId', getCopyrightByTrack);

export default router;
