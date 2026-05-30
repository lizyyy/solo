import { Router } from 'express';
import { upload, importVotes, importCopyrights } from '../controllers/ImportController.js';

const router = Router();

router.post('/votes', upload.single('file'), importVotes);
router.post('/copyright', upload.single('file'), importCopyrights);

export default router;
