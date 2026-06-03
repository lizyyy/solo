import { Router } from 'express';
import multer from 'multer';
import { AdjustmentController } from '../controllers/AdjustmentController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', AdjustmentController.getAll);
router.get('/flagged', AdjustmentController.getFlagged);
router.get('/:id', AdjustmentController.getById);
router.get('/:id/process-history', AdjustmentController.getProcessHistory);
router.post('/import/csv', AdjustmentController.importCsv);
router.post('/import/excel', upload.single('file'), AdjustmentController.importExcel);

export default router;
