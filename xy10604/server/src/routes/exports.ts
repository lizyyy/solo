import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import { generateExport, getReviewDetailsForExport, getStatistics } from '../services/exportService';

const router = Router();

router.use(authenticateToken);

router.get(
  '/statistics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const stats = await getStatistics({
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(stats);
  })
);

router.get(
  '/excel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const buffer = await generateExport({
      format: 'excel',
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      reviewerId: req.query.reviewerId as string,
      includeAuditLogs: req.query.includeAuditLogs !== 'false',
      includeReviews: req.query.includeReviews !== 'false',
      includeDiscards: req.query.includeDiscards !== 'false',
    });

    const fileName = `reagent_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    res.send(buffer);
  })
);

router.get(
  '/review/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const details = await getReviewDetailsForExport(req.params.id);
    res.json(details);
  })
);

export default router;
