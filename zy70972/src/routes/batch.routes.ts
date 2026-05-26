import { Router, Request, Response } from 'express';
import * as batchController from '../controllers/batch.controller';
import multer from 'multer';
import * as path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({ storage });

const router = Router();

router.post('/upload', upload.single('file'), batchController.uploadAndCreateBatch);
router.post('/:id/process', batchController.processBatch);
router.post('/:id/reject', batchController.rejectBatch);
router.post('/:id/review', batchController.markBatchForReview);
router.get('/:id', batchController.getBatch);
router.get('/', batchController.listBatches);

export default router;
