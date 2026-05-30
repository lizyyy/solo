import { Router, type Request, type Response } from 'express';
import { dataImportController } from '../src/controllers/DataImportController.js';

const router = Router();

router.post('/preview', (req: Request, res: Response) => dataImportController.previewImport(req, res));
router.post('/execute', (req: Request, res: Response) => dataImportController.executeImport(req, res));
router.get('/batches', (req: Request, res: Response) => dataImportController.listImportBatches(req, res));
router.get('/batches/:batchId', (req: Request, res: Response) => dataImportController.getImportBatch(req, res));
router.get('/batches/:batchId/warnings', (req: Request, res: Response) => dataImportController.getBatchWarnings(req, res));
router.get('/tasks/:taskId', (req: Request, res: Response) => dataImportController.getBatchTask(req, res));

export default router;
