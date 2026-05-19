import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { qcService } from '../services/QualityControlService';
import { exportService } from '../services/ExportService';
import { maskSensitiveData } from '../utils/logger';
import { BatchStatus } from '../types';

export async function importBatch(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const { batch, isNew } = await qcService.importBatch(req.body, {
      operator: req.user?.role,
      requestId,
      ipAddress: req.ip,
    });

    const responseData = req.user?.role === 'admin' ? batch : maskSensitiveData(batch);

    res.json({
      success: true,
      data: responseData,
      isNew,
      message: isNew ? 'Batch imported successfully' : 'Batch already exists',
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function batchImport(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const result = await qcService.batchImport(req.body.batches || [], {
      operator: req.user?.role,
      requestId,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: result,
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function performJudgment(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const batch = await qcService.performJudgment(req.body, {
      operator: req.user?.role,
      requestId,
      ipAddress: req.ip,
    });

    const responseData = req.user?.role === 'admin' ? batch : maskSensitiveData(batch);

    res.json({
      success: true,
      data: responseData,
      message: 'Batch judgment completed',
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function performReview(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const batch = await qcService.performReview(req.body, {
      operator: req.user?.role,
      requestId,
      ipAddress: req.ip,
    });

    const responseData = req.user?.role === 'admin' ? batch : maskSensitiveData(batch);

    res.json({
      success: true,
      data: responseData,
      message: 'Batch review completed',
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function recordRework(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const reworkRecord = await qcService.recordRework(req.body, {
      operator: req.user?.role,
      requestId,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: reworkRecord,
      message: 'Rework record created',
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function generateQualityOrder(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const order = await qcService.generateQualityOrder(req.body, {
      operator: req.user?.role,
      requestId,
      ipAddress: req.ip,
    });

    const responseData = req.user?.role === 'admin' ? order : maskSensitiveData(order);

    res.json({
      success: true,
      data: responseData,
      message: 'Quality order generated',
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function getBatch(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const { batchNumber } = req.params;

    const batch = await qcService.getBatch(batchNumber);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
        timestamp: Date.now(),
        requestId,
      });
    }

    const responseData = req.user?.role === 'admin' ? batch : maskSensitiveData(batch);

    res.json({
      success: true,
      data: responseData,
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function getBatches(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const {
      status,
      startDate,
      endDate,
      productName,
      isPassed,
      hasRework,
      page = 1,
      pageSize = 20,
    } = req.query;

    const filters: any = {
      status: status as BatchStatus,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      productName: productName as string,
      isPassed: isPassed !== undefined ? isPassed === 'true' : undefined,
      hasRework: hasRework !== undefined ? hasRework === 'true' : undefined,
      page: Number(page),
      pageSize: Number(pageSize),
    };

    const result = await qcService.getBatches(filters);

    const responseData = {
      ...result,
      data: req.user?.role === 'admin'
        ? result.data
        : result.data.map(maskSensitiveData),
    };

    res.json({
      success: true,
      data: responseData,
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function getTrendData(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const filters: any = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      groupBy: groupBy as 'day' | 'week' | 'month',
    };

    const data = await qcService.getTrendData(filters);

    res.json({
      success: true,
      data,
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function markBatchComplete(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const { batchNumber } = req.params;

    const batch = await qcService.markBatchComplete(batchNumber, {
      operator: req.user?.role,
      requestId,
    });

    const responseData = req.user?.role === 'admin' ? batch : maskSensitiveData(batch);

    res.json({
      success: true,
      data: responseData,
      message: 'Batch marked as completed',
      timestamp: Date.now(),
      requestId,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function exportBatches(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const { batchNumbers, format = 'excel' } = req.body;

    if (!batchNumbers || !Array.isArray(batchNumbers) || batchNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'batchNumbers array is required',
        timestamp: Date.now(),
        requestId,
      });
    }

    const batches: any[] = [];
    for (const batchNumber of batchNumbers) {
      const batch = await qcService.getBatch(batchNumber);
      if (batch) {
        batches.push(batch);
      }
    }

    if (batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No batches found',
        timestamp: Date.now(),
        requestId,
      });
    }

    const includeSensitive = req.user?.role === 'admin';

    let filePath: string;
    let contentType: string;

    if (format === 'excel') {
      filePath = await exportService.exportBatchesToExcel(batches, {
        includeSensitive,
        operator: req.user?.role,
        requestId,
        ipAddress: req.ip,
      });
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported format',
        timestamp: Date.now(),
        requestId,
      });
    }

    res.download(filePath, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function exportBatchDetail(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const { batchNumber } = req.params;
    const { format = 'excel' } = req.query;

    const batch = await qcService.getBatch(batchNumber);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
        timestamp: Date.now(),
        requestId,
      });
    }

    const includeSensitive = req.user?.role === 'admin';

    let filePath: string;
    let contentType: string;

    if (format === 'excel') {
      filePath = await exportService.exportBatchDetailToExcel(batch, {
        includeSensitive,
        operator: req.user?.role,
        requestId,
        ipAddress: req.ip,
      });
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported format',
        timestamp: Date.now(),
        requestId,
      });
    }

    res.download(filePath, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}

export async function exportQualityOrderPdf(req: AuthRequest, res: Response) {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const { batchNumber } = req.params;

    const batch = await qcService.getBatch(batchNumber);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
        timestamp: Date.now(),
        requestId,
      });
    }

    if (!batch.qualityOrders || batch.qualityOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No quality order found for this batch',
        timestamp: Date.now(),
        requestId,
      });
    }

    const includeSensitive = req.user?.role === 'admin';

    const filePath = await exportService.exportQualityOrderToPdf(
      batch.qualityOrders[0],
      batch,
      {
        includeSensitive,
        operator: req.user?.role,
        requestId,
        ipAddress: req.ip,
      }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.download(filePath, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'],
    });
  }
}
