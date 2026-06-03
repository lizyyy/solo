import { Router } from 'express';
import { importController, upload } from '../controllers/ImportController';

const router = Router();

router.post('/', upload.single('file'), importController.importCSV);
router.post('/check-duplicate', upload.single('file'), importController.checkDuplicate);
router.get('/batches', importController.getBatches);

export default router;
