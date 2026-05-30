import { Router, type Request, type Response } from 'express';
import { riskAnalysisController } from '../src/controllers/RiskAnalysisController.js';

const router = Router();

router.post('/analyze', (req: Request, res: Response) => riskAnalysisController.analyze(req, res));
router.get('/results', (req: Request, res: Response) => riskAnalysisController.getResults(req, res));
router.get('/results/customer/:customerId', (req: Request, res: Response) => riskAnalysisController.getResultByCustomer(req, res));
router.get('/graph', (req: Request, res: Response) => riskAnalysisController.getGraph(req, res));
router.get('/dashboard', (req: Request, res: Response) => riskAnalysisController.getDashboardStats(req, res));
router.get('/tasks/:taskId', (req: Request, res: Response) => riskAnalysisController.getBatchTask(req, res));

export default router;
