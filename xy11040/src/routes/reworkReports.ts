import { Router, Request, Response } from 'express';
import { reworkService } from '../services/reworkService';
import { validateRequest } from '../middleware/errorHandler';

const router = Router();

router.post(
  '/',
  validateRequest([
    'processingOrderNumber',
    'reporter',
    'reporterRole',
    'reworkItems',
    'source',
    'userRole'
  ]),
  (req: Request, res: Response) => {
    const result = reworkService.createReworkReport(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CREATE_REWORK_FAILED',
          message: result.message,
          details: result.axisIssues
        }
      });
    }

    res.status(201).json(result);
  }
);

router.get('/', (req: Request, res: Response) => {
  const reports = reworkService.getAllReworkReports();
  res.json({
    success: true,
    data: reports,
    total: reports.length
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const report = reworkService.getReworkReport(req.params.id);
  if (!report) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '返工报告不存在'
      }
    });
  }
  res.json({
    success: true,
    data: report
  });
});

router.get('/order/:processingOrderId', (req: Request, res: Response) => {
  const reports = reworkService.getReworkReportsByOrder(req.params.processingOrderId);
  res.json({
    success: true,
    data: reports,
    total: reports.length
  });
});

router.patch(
  '/:id/status',
  validateRequest(['targetStatus', 'performedBy', 'userRole']),
  (req: Request, res: Response) => {
    const result = reworkService.updateReworkStatus({
      reworkReportId: req.params.id,
      targetStatus: req.body.targetStatus,
      performedBy: req.body.performedBy,
      userRole: req.body.userRole,
      reviewComments: req.body.reviewComments,
      assignedTo: req.body.assignedTo,
      inspectionResult: req.body.inspectionResult
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'STATUS_UPDATE_FAILED',
          message: result.message,
          details: result.availableTransitions
        }
      });
    }

    res.json(result);
  }
);

router.get('/:id/axis-issues', (req: Request, res: Response) => {
  const issues = reworkService.getAxisIssues(req.params.id);
  res.json({
    success: true,
    data: issues
  });
});

router.post(
  '/:id/sync-axis',
  validateRequest(['performedBy']),
  (req: Request, res: Response) => {
    const result = reworkService.syncAxisFromRework(
      req.params.id,
      req.body.performedBy
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'AXIS_SYNC_FAILED',
          message: result.message
        }
      });
    }

    res.json(result);
  }
);

export default router;
