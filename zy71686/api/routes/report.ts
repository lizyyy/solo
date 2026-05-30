import { Router, type Request, type Response } from 'express';
import { reportController } from '../src/controllers/ReportController.js';

const router = Router();

router.post('/generate', (req: Request, res: Response) => reportController.generateReport(req, res));
router.get('/download/:reportId', (req: Request, res: Response) => reportController.downloadReport(req, res));
router.get('/tasks/:taskId', (req: Request, res: Response) => reportController.getBatchTask(req, res));

export default router;
