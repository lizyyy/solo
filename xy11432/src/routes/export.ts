import { Router, Request, Response } from 'express';
import {
  exportAuditData,
  classifyRetriableItems,
  getExportSnapshot,
  verifyExportConsistency,
  getDeadLetterExportSummary,
} from '../services/export';
import { ExportRequest } from '../types';

const router = Router();

router.post('/audit', (req: Request, res: Response) => {
  const { format, filters, includeHistory, includeDeadLetter, exportedBy } = req.body;
  
  if (!format || !exportedBy) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'format and exportedBy are required',
    });
    return;
  }
  
  try {
    const result = exportAuditData(
      { format, filters, includeHistory, includeDeadLetter } as ExportRequest,
      exportedBy
    );
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.csv"`);
      res.send(result.content);
    } else {
      res.json({
        success: true,
        data: {
          snapshotId: result.snapshotId,
          recordCount: result.recordCount,
          content: JSON.parse(result.content),
        },
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Export failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/retriable-classification', (req: Request, res: Response) => {
  const classifications = classifyRetriableItems();
  res.json({
    success: true,
    data: classifications,
  });
});

router.get('/snapshot/:snapshotId', (req: Request, res: Response) => {
  const snapshot = getExportSnapshot(req.params.snapshotId);
  if (!snapshot) {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'Export snapshot not found',
    });
    return;
  }
  res.json({
    success: true,
    data: snapshot,
  });
});

router.post('/verify-consistency/:snapshotId', (req: Request, res: Response) => {
  const { format, filters, includeHistory, includeDeadLetter } = req.body;
  
  try {
    const result = verifyExportConsistency(
      req.params.snapshotId,
      { format, filters, includeHistory, includeDeadLetter } as ExportRequest
    );
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/dead-letter-summary', (req: Request, res: Response) => {
  const summary = getDeadLetterExportSummary();
  res.json({
    success: true,
    data: summary,
  });
});

export default router;
