import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { batchRepository } from '../repositories/BatchRepository';
import { disbursementRepository } from '../repositories/DisbursementRepository';
import { batchProcessor } from '../services/BatchProcessor';
import { BatchStatus, CreateBatchRequest } from '../types';
import { logger } from '../utils/logger';

const router = Router();

const createSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  month: Joi.number().integer().min(1).max(12).required(),
  concurrency: Joi.number().integer().min(1).max(100).optional().default(10),
  rateLimit: Joi.number().integer().min(1).max(1000).optional().default(100),
  chunkSize: Joi.number().integer().min(10).max(1000).optional().default(100)
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const data = value as CreateBatchRequest;
    
    const batch = await batchProcessor.createBatch(
      data.name,
      data.year,
      data.month,
      {
        description: data.description,
        concurrency: data.concurrency,
        rateLimit: data.rateLimit,
        chunkSize: data.chunkSize
      }
    );

    logger.info('Batch created', { batchId: batch.id });

    res.json({
      success: true,
      data: {
        batch: {
          id: batch.id,
          name: batch.name,
          description: batch.description,
          year: batch.year,
          month: batch.month,
          totalRecords: batch.totalRecords,
          totalAmount: batch.totalAmount,
          status: batch.status,
          concurrency: batch.concurrency,
          rateLimit: batch.rateLimit,
          chunkSize: batch.chunkSize,
          createdAt: batch.createdAt
        }
      }
    });
  } catch (error) {
    logger.error('Failed to create batch', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    if (error instanceof Error && error.message.includes('No payrolls found')) {
      return res.status(400).json({
        success: false,
        error: 'No payrolls found for the specified month',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const page = parseInt(_req.query.page as string) || 1;
    const pageSize = parseInt(_req.query.pageSize as string) || 20;
    const status = _req.query.status as string | undefined;
    
    let result;
    
    if (status && Object.values(BatchStatus).includes(status as BatchStatus)) {
      const batches = await batchRepository.findByStatus(status as BatchStatus);
      result = { batches, total: batches.length };
    } else {
      result = await batchRepository.findAll(page, pageSize);
    }
    
    res.json({
      success: true,
      data: {
        batches: result.batches.map(b => ({
          id: b.id,
          name: b.name,
          description: b.description,
          year: b.year,
          month: b.month,
          totalRecords: b.totalRecords,
          totalAmount: b.totalAmount,
          processedRecords: b.processedRecords,
          successRecords: b.successRecords,
          failedRecords: b.failedRecords,
          status: b.status,
          concurrency: b.concurrency,
          rateLimit: b.rateLimit,
          startedAt: b.startedAt,
          completedAt: b.completedAt,
          createdAt: b.createdAt
        })),
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / pageSize)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get batches', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get batches',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const batch = await batchRepository.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    res.json({
      success: true,
      data: {
        batch: {
          id: batch.id,
          name: batch.name,
          description: batch.description,
          year: batch.year,
          month: batch.month,
          totalRecords: batch.totalRecords,
          totalAmount: batch.totalAmount,
          processedRecords: batch.processedRecords,
          successRecords: batch.successRecords,
          failedRecords: batch.failedRecords,
          status: batch.status,
          concurrency: batch.concurrency,
          rateLimit: batch.rateLimit,
          chunkSize: batch.chunkSize,
          startedAt: batch.startedAt,
          completedAt: batch.completedAt,
          failedAt: batch.failedAt,
          pausedAt: batch.pausedAt,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get batch', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const batch = await batchRepository.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    if (batch.status === BatchStatus.RUNNING) {
      return res.json({
        success: true,
        message: 'Batch is already running',
        data: {
          batchId: batch.id,
          status: batch.status
        }
      });
    }

    if (batch.status === BatchStatus.COMPLETED) {
      return res.status(400).json({
        success: false,
        error: 'Cannot start a completed batch'
      });
    }

    if (batch.status === BatchStatus.CANCELLED) {
      return res.status(400).json({
        success: false,
        error: 'Cannot start a cancelled batch'
      });
    }

    await batchProcessor.startBatch(req.params.id);

    logger.info('Batch started', { batchId: req.params.id });

    res.json({
      success: true,
      message: 'Batch started successfully',
      data: {
        batchId: req.params.id,
        status: BatchStatus.RUNNING
      }
    });
  } catch (error) {
    logger.error('Failed to start batch', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to start batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const batch = await batchRepository.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    if (batch.status !== BatchStatus.RUNNING) {
      return res.status(400).json({
        success: false,
        error: 'Batch is not running'
      });
    }

    await batchProcessor.pauseBatch(req.params.id);

    logger.info('Batch paused', { batchId: req.params.id });

    res.json({
      success: true,
      message: 'Batch pause requested successfully',
      data: {
        batchId: req.params.id,
        status: BatchStatus.PAUSED
      }
    });
  } catch (error) {
    logger.error('Failed to pause batch', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to pause batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const batch = await batchRepository.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    if (batch.status !== BatchStatus.PAUSED) {
      return res.status(400).json({
        success: false,
        error: 'Batch is not paused'
      });
    }

    await batchProcessor.resumeBatch(req.params.id);

    logger.info('Batch resumed', { batchId: req.params.id });

    res.json({
      success: true,
      message: 'Batch resumed successfully',
      data: {
        batchId: req.params.id,
        status: BatchStatus.RUNNING
      }
    });
  } catch (error) {
    logger.error('Failed to resume batch', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to resume batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const batch = await batchRepository.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    if (batch.status === BatchStatus.COMPLETED || batch.status === BatchStatus.CANCELLED) {
      return res.status(400).json({
        success: false,
        error: 'Batch is already completed or cancelled'
      });
    }

    await batchProcessor.cancelBatch(req.params.id);

    logger.info('Batch cancelled', { batchId: req.params.id });

    res.json({
      success: true,
      message: 'Batch cancelled successfully',
      data: {
        batchId: req.params.id,
        status: BatchStatus.CANCELLED
      }
    });
  } catch (error) {
    logger.error('Failed to cancel batch', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/:id/progress', async (req: Request, res: Response) => {
  try {
    const progress = await batchProcessor.getBatchProgress(req.params.id);
    
    res.json({
      success: true,
      data: {
        progress: {
          batchId: progress.batchId,
          status: progress.status,
          totalRecords: progress.totalRecords,
          processedRecords: progress.processedRecords,
          successRecords: progress.successRecords,
          failedRecords: progress.failedRecords,
          progressPercentage: progress.progressPercentage,
          estimatedTimeRemaining: progress.estimatedTimeRemaining,
          currentChunk: progress.currentChunk,
          totalChunks: progress.totalChunks
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get batch progress', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    if (error instanceof Error && error.message.includes('Batch not found')) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get batch progress',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const batch = await batchRepository.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    if (batch.status === BatchStatus.RUNNING) {
      return res.status(400).json({
        success: false,
        error: 'Cannot retry while batch is running'
      });
    }

    const result = await batchProcessor.retryFailedDisbursements(req.params.id);

    logger.info('Retry completed', { 
      batchId: req.params.id, 
      retried: result.retried, 
      failed: result.failed 
    });

    res.json({
      success: true,
      message: 'Retry completed',
      data: {
        retried: result.retried,
        failed: result.failed
      }
    });
  } catch (error) {
    logger.error('Failed to retry disbursements', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retry disbursements',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/:id/reconcile', async (req: Request, res: Response) => {
  try {
    const result = await batchProcessor.reconcileBatch(req.params.id);
    
    res.json({
      success: true,
      data: {
        reconciliation: {
          batchId: result.batchId,
          expectedAmount: result.expectedAmount,
          actualAmount: result.actualAmount,
          expectedCount: result.expectedCount,
          actualCount: result.actualCount,
          discrepancies: result.discrepancies,
          isBalanced: result.isBalanced
        }
      }
    });
  } catch (error) {
    logger.error('Failed to reconcile batch', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    if (error instanceof Error && error.message.includes('Batch not found')) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to reconcile batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/:id/disbursements', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 100;
    const status = req.query.status as string | undefined;
    
    let disbursements;
    
    if (status) {
      disbursements = await disbursementRepository.findByBatchIdAndStatus(
        req.params.id,
        status as any
      );
    } else {
      disbursements = await disbursementRepository.findByBatchId(req.params.id);
    }

    const total = disbursements.length;
    const paginated = disbursements.slice((page - 1) * pageSize, page * pageSize);

    res.json({
      success: true,
      data: {
        disbursements: paginated.map(d => ({
          id: d.id,
          payrollId: d.payrollId,
          employeeId: d.employeeId,
          amount: d.amount,
          idempotencyKey: d.idempotencyKey,
          status: d.status,
          retryCount: d.retryCount,
          maxRetries: d.maxRetries,
          errorMessage: d.errorMessage,
          errorCode: d.errorCode,
          externalTransactionId: d.externalTransactionId,
          processedAt: d.processedAt
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get disbursements', { 
      batchId: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get disbursements',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const batch = await batchRepository.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    if (batch.status === BatchStatus.RUNNING) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a running batch'
      });
    }

    await batchRepository.delete(req.params.id);

    logger.info('Batch deleted', { batchId: req.params.id });

    res.json({
      success: true,
      message: 'Batch deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete batch', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as batchesRouter };
