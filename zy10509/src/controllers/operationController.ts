import { Request, Response, NextFunction } from 'express';
import * as operationService from '../services/operationService';
import * as exportService from '../services/exportService';
import { CreateOperationRequest, ConfirmOperationRequest, ExecuteOperationRequest, FailOperationRequest, ManualCorrectionRequest, QueryOperationsFilter } from '../types';

export async function createOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request: CreateOperationRequest = req.body;
    const operation = await operationService.createOperation(request);
    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function getOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const operation = await operationService.getOperationById(id);
    
    if (!operation) {
      res.status(404).json({
        success: false,
        error: {
          code: 'OPERATION_NOT_FOUND',
          message: '操作记录不存在'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function getOperationByNo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { operationNo } = req.params;
    const operation = await operationService.getOperationByNo(operationNo);
    
    if (!operation) {
      res.status(404).json({
        success: false,
        error: {
          code: 'OPERATION_NOT_FOUND',
          message: '操作记录不存在'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function queryOperations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filter: QueryOperationsFilter = {
      status: req.query.status as any,
      riskLevel: req.query.riskLevel as any,
      executorId: req.query.executorId as string,
      reviewerId: req.query.reviewerId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20
    };

    const result = await operationService.queryOperations(filter);
    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const request: ConfirmOperationRequest = req.body;
    const operation = await operationService.confirmOperation(id, request);
    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function lockOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const operation = await operationService.lockOperation(id);
    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function startExecution(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const operation = await operationService.startExecution(id);
    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function completeOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const request: ExecuteOperationRequest = req.body;
    const operation = await operationService.completeOperation(id, request);
    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function failOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const request: FailOperationRequest = req.body;
    const operation = await operationService.failOperation(id, request);
    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function abortOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const operation = await operationService.abortOperation(id);
    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function markForManualCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { errorMessage } = req.body;
    const operation = await operationService.markForManualCorrection(id, errorMessage);
    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function manualCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const request: ManualCorrectionRequest = req.body;
    const operation = await operationService.manualCorrection(id, request);
    res.json({
      success: true,
      data: operation
    });
  } catch (err) {
    next(err);
  }
}

export async function exportCSV(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const csv = await exportService.exportToCSV(filter);
    const filename = `operations_${new Date().toISOString().slice(0, 10)}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

export async function exportJSON(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const json = await exportService.exportToJSON(filter);
    const filename = `operations_${new Date().toISOString().slice(0, 10)}.json`;
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(json);
  } catch (err) {
    next(err);
  }
}

export async function getStatisticsReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const report = await exportService.exportStatisticsReport(filter);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(report);
  } catch (err) {
    next(err);
  }
}

export async function getStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const operations = await operationService.getAllOperationsForExport(filter);
    const stats = exportService.generateStatistics(operations);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
}
