import { Router, Request, Response } from 'express';
import { batchProcessor } from '../services/BatchProcessor';
import { batchRepository } from '../repositories/BatchRepository';
import { disbursementRepository } from '../repositories/DisbursementRepository';
import { logger } from '../utils/logger';
import { DisbursementStatus, BatchStatus } from '../types';

const router = Router();

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await batchProcessor.getPerformanceStats();
    
    const activeBatches = batchProcessor.getActiveBatches();
    
    const pendingBatches = await batchRepository.findByStatus(BatchStatus.PENDING);
    const runningBatches = await batchRepository.findByStatus(BatchStatus.RUNNING);
    const pausedBatches = await batchRepository.findByStatus(BatchStatus.PAUSED);
    const completedBatches = await batchRepository.findByStatus(BatchStatus.COMPLETED);
    const failedBatches = await batchRepository.findByStatus(BatchStatus.FAILED);
    
    const pendingDisbursements = await disbursementRepository.countByBatchIdAndStatus(
      '' as any,
      DisbursementStatus.PENDING
    );
    const processingDisbursements = await disbursementRepository.countByBatchIdAndStatus(
      '' as any,
      DisbursementStatus.PROCESSING
    );
    const successDisbursements = await disbursementRepository.countByBatchIdAndStatus(
      '' as any,
      DisbursementStatus.SUCCESS
    );
    const failedDisbursements = await disbursementRepository.countByBatchIdAndStatus(
      '' as any,
      DisbursementStatus.FAILED
    );
    const cancelledDisbursements = await disbursementRepository.countByBatchIdAndStatus(
      '' as any,
      DisbursementStatus.CANCELLED
    );

    res.json({
      success: true,
      data: {
        performance: {
          totalBatches: stats.totalBatches,
          totalDisbursements: stats.totalDisbursements,
          successRate: stats.successRate,
          averageProcessingTime: stats.averageProcessingTime,
          throughput: stats.throughput
        },
        batches: {
          active: activeBatches.length,
          pending: pendingBatches.length,
          running: runningBatches.length,
          paused: pausedBatches.length,
          completed: completedBatches.length,
          failed: failedBatches.length
        },
        disbursements: {
          pending: pendingDisbursements,
          processing: processingDisbursements,
          success: successDisbursements,
          failed: failedDisbursements,
          cancelled: cancelledDisbursements,
          total: pendingDisbursements + processingDisbursements + successDisbursements + failedDisbursements + cancelledDisbursements
        },
        activeBatchIds: activeBatches
      }
    });
  } catch (error) {
    logger.error('Failed to get performance stats', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get performance stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const db = (await import('../database')).db;
    await db.get('SELECT 1');
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected'
        }
      }
    });
  } catch (error) {
    logger.error('Health check failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'disconnected'
        }
      }
    });
  }
});

export { router as performanceRouter };
