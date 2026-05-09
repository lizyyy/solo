import { Router, Request, Response } from 'express';
import { InvitationService } from '../services/invitationService';
import { DatabaseService } from '../database/database';

export function createRoutes(db: DatabaseService): Router {
  const router = Router();
  const service = new InvitationService(db);

  router.post('/batches', (req: Request, res: Response) => {
    const input = {
      ...req.body,
      enrollmentStartTime: new Date(req.body.enrollmentStartTime),
      enrollmentEndTime: new Date(req.body.enrollmentEndTime),
      executionStartTime: new Date(req.body.executionStartTime),
      executionEndTime: new Date(req.body.executionEndTime)
    };

    const result = service.createBatch(input, req.headers['x-operator'] as string);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.status(201).json({
      success: true,
      data: result.data,
      events: result.events
    });
  });

  router.get('/batches', (req: Request, res: Response) => {
    const batches = service.getAllBatches();
    res.json({
      success: true,
      data: batches
    });
  });

  router.get('/batches/:batchId', (req: Request, res: Response) => {
    const batch = service.getBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: '邀约批次不存在'
        }
      });
    }

    res.json({
      success: true,
      data: batch
    });
  });

  router.post('/batches/:batchId/publish', (req: Request, res: Response) => {
    const result = service.publishBatch(
      req.params.batchId,
      req.headers['x-operator'] as string
    );
    handleOperationResult(res, result);
  });

  router.post('/batches/:batchId/start-enrollment', (req: Request, res: Response) => {
    const result = service.startEnrollment(
      req.params.batchId,
      req.headers['x-operator'] as string
    );
    handleOperationResult(res, result);
  });

  router.post('/batches/:batchId/close-enrollment', (req: Request, res: Response) => {
    const result = service.closeEnrollment(
      req.params.batchId,
      req.headers['x-operator'] as string
    );
    handleOperationResult(res, result);
  });

  router.post('/batches/:batchId/start-execution', (req: Request, res: Response) => {
    const result = service.startExecution(
      req.params.batchId,
      req.headers['x-operator'] as string
    );
    handleOperationResult(res, result);
  });

  router.post('/batches/:batchId/complete-execution', (req: Request, res: Response) => {
    const result = service.completeExecution(
      req.params.batchId,
      req.headers['x-operator'] as string
    );
    handleOperationResult(res, result);
  });

  router.post('/batches/:batchId/start-settlement', (req: Request, res: Response) => {
    const result = service.startSettlement(
      req.params.batchId,
      req.headers['x-operator'] as string
    );
    handleOperationResult(res, result);
  });

  router.post('/batches/:batchId/complete-settlement', (req: Request, res: Response) => {
    const result = service.completeSettlement(
      req.params.batchId,
      req.headers['x-operator'] as string
    );
    handleOperationResult(res, result);
  });

  router.get('/batches/:batchId/summary', (req: Request, res: Response) => {
    const result = service.getBatchSummary(req.params.batchId);
    handleOperationResult(res, result);
  });

  router.get('/batches/:batchId/events', (req: Request, res: Response) => {
    const events = service.getEventsByBatch(req.params.batchId);
    res.json({
      success: true,
      data: events
    });
  });

  router.get('/batches/:batchId/enrollments', (req: Request, res: Response) => {
    const enrollments = service.getEnrollmentsByBatch(req.params.batchId);
    res.json({
      success: true,
      data: enrollments
    });
  });

  router.post('/batches/:batchId/calculate-settlement', (req: Request, res: Response) => {
    const result = service.calculateSettlementForBatch(
      req.params.batchId,
      req.headers['x-operator'] as string
    );
    handleOperationResult(res, result);
  });

  router.get('/batches/:batchId/replay', (req: Request, res: Response) => {
    const result = service.replayBatchEvents(req.params.batchId);
    handleOperationResult(res, result);
  });

  router.post('/enrollments', (req: Request, res: Response) => {
    const result = service.createEnrollment(
      req.body,
      req.headers['x-operator'] as string
    );

    if (!result.success) {
      const status = result.error?.code === 'DUPLICATE_ENROLLMENT' ? 409 : 400;
      return res.status(status).json({
        success: false,
        error: result.error
      });
    }

    res.status(201).json({
      success: true,
      data: result.data,
      events: result.events
    });
  });

  router.get('/enrollments/:enrollmentId', (req: Request, res: Response) => {
    const enrollment = service.getEnrollment(req.params.enrollmentId);
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ENROLLMENT_NOT_FOUND',
          message: '报名记录不存在'
        }
      });
    }

    res.json({
      success: true,
      data: enrollment
    });
  });

  router.post('/enrollments/:enrollmentId/review', (req: Request, res: Response) => {
    const result = service.reviewEnrollment({
      enrollmentId: req.params.enrollmentId,
      approved: req.body.approved,
      reviewComment: req.body.reviewComment,
      operator: req.headers['x-operator'] as string
    });
    handleOperationResult(res, result);
  });

  router.get('/enrollments/:enrollmentId/events', (req: Request, res: Response) => {
    const events = service.getEventsByEnrollment(req.params.enrollmentId);
    res.json({
      success: true,
      data: events
    });
  });

  router.get('/enrollments/:enrollmentId/execution-records', (req: Request, res: Response) => {
    const records = service.getExecutionRecords(req.params.enrollmentId);
    res.json({
      success: true,
      data: records
    });
  });

  router.get('/enrollments/:enrollmentId/deviation', (req: Request, res: Response) => {
    const result = service.calculateDeviationForEnrollment(req.params.enrollmentId);
    handleOperationResult(res, result);
  });

  router.post('/enrollments/:enrollmentId/calculate-settlement', (req: Request, res: Response) => {
    const result = service.calculateSettlementForEnrollment(
      req.params.enrollmentId,
      req.headers['x-operator'] as string
    );
    handleOperationResult(res, result);
  });

  router.get('/enrollments/:enrollmentId/settlement', (req: Request, res: Response) => {
    const settlement = service.getSettlementResult(req.params.enrollmentId);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SETTLEMENT_NOT_FOUND',
          message: '结算记录不存在'
        }
      });
    }

    res.json({
      success: true,
      data: settlement
    });
  });

  router.post('/execution-records', (req: Request, res: Response) => {
    const input = {
      ...req.body,
      timestamp: new Date(req.body.timestamp)
    };

    const result = service.submitExecutionRecord(
      input,
      req.headers['x-operator'] as string
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.status(201).json({
      success: true,
      data: result.data,
      events: result.events
    });
  });

  function handleOperationResult(res: Response, result: any) {
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      events: result.events
    });
  }

  return router;
}
