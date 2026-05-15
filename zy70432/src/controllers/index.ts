import { Request, Response } from 'express';
import { mockRecorderService } from '../services/recorder';
import { exportService } from '../services/export';
import { auditStore, sessionStore } from '../store';
import { ApiError } from '../middleware/errorHandler';
import { SearchKeywordReport, ExportOptions } from '../types';

export class RecorderController {
  async submitRecord(req: Request, res: Response): Promise<void> {
    const { record, operator } = req.body as {
      record: SearchKeywordReport;
      operator: string;
    };

    if (!record) {
      throw new ApiError(400, 'MISSING_RECORD', '缺少记录数据');
    }

    if (!operator) {
      throw new ApiError(400, 'MISSING_OPERATOR', '缺少操作人信息');
    }

    const result = mockRecorderService.submitRecord(record, operator);

    if (result.status === 'failure') {
      res.status(400).json({
        success: false,
        data: result,
        error: {
          code: 'VALIDATION_ERROR',
          message: '记录验证失败',
          details: { fieldErrors: result.errors }
        }
      });
      return;
    }

    if (result.status === 'conflict') {
      res.status(409).json({
        success: false,
        data: result,
        error: {
          code: 'CONFLICT_DETECTED',
          message: result.message,
          details: { existingRecordId: result.recordId }
        }
      });
      return;
    }

    res.json({
      success: true,
      data: result
    });
  }

  async submitBatch(req: Request, res: Response): Promise<void> {
    const { records, operator } = req.body as {
      records: SearchKeywordReport[];
      operator: string;
    };

    if (!records || !Array.isArray(records)) {
      throw new ApiError(400, 'INVALID_RECORDS', '记录数据必须是数组');
    }

    if (!operator) {
      throw new ApiError(400, 'MISSING_OPERATOR', '缺少操作人信息');
    }

    const result = mockRecorderService.submitBatch(records, operator);

    res.json({
      success: true,
      data: result
    });
  }

  async playback(req: Request, res: Response): Promise<void> {
    const { sessionId, records, operator } = req.body as {
      sessionId: string;
      records: SearchKeywordReport[];
      operator: string;
    };

    if (!sessionId) {
      throw new ApiError(400, 'MISSING_SESSION_ID', '缺少会话ID');
    }

    const result = mockRecorderService.playback(sessionId, records, operator);

    res.json({
      success: true,
      data: result
    });
  }

  async queryByFailureType(req: Request, res: Response): Promise<void> {
    const { failureType } = req.params;

    const result = mockRecorderService.queryByFailureType(failureType as any);

    res.json({
      success: true,
      data: {
        failureType,
        count: result.length,
        records: result
      }
    });
  }

  async getAllFailedRecords(_req: Request, res: Response): Promise<void> {
    const result = mockRecorderService.getAllFailedRecords();

    res.json({
      success: true,
      data: {
        totalFailed: result.records.length,
        groupedByFailure: result.groupedByFailure,
        records: result.records
      }
    });
  }
}

export class ExportController {
  async exportFailedRecords(req: Request, res: Response): Promise<void> {
    const options = req.body as ExportOptions;
    const operator = req.headers['x-operator'] as string;

    if (!operator) {
      throw new ApiError(400, 'MISSING_OPERATOR', '请在请求头中提供 x-operator');
    }

    const result = exportService.exportFailedRecords(options, operator);

    res.json({
      success: true,
      data: {
        message: '导出成功',
        filePath: result.filePath,
        recordCount: result.recordCount,
        failureTypes: result.failureTypes
      }
    });
  }

  async getExportFiles(_req: Request, res: Response): Promise<void> {
    const files = exportService.getExportFiles();

    res.json({
      success: true,
      data: { files }
    });
  }
}

export class AuditController {
  async getAllAudit(_req: Request, res: Response): Promise<void> {
    const entries = auditStore.getAll();

    res.json({
      success: true,
      data: { entries }
    });
  }

  async getPendingConfirmations(_req: Request, res: Response): Promise<void> {
    const entries = auditStore.getPendingConfirmations();

    res.json({
      success: true,
      data: {
        count: entries.length,
        entries
      }
    });
  }

  async confirmAuditEntry(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { confirmedBy } = req.body;

    if (!confirmedBy) {
      throw new ApiError(400, 'MISSING_CONFIRMED_BY', '缺少确认人信息');
    }

    const success = auditStore.confirm(id, confirmedBy);

    if (!success) {
      throw new ApiError(404, 'AUDIT_ENTRY_NOT_FOUND', '审计记录不存在');
    }

    res.json({
      success: true,
      data: { message: '确认成功' }
    });
  }
}

export class SessionController {
  async createSession(req: Request, res: Response): Promise<void> {
    const { name, createdBy } = req.body;

    if (!name || !createdBy) {
      throw new ApiError(400, 'MISSING_FIELDS', '缺少会话名称或创建人信息');
    }

    const session = sessionStore.create(name, createdBy);

    res.json({
      success: true,
      data: session
    });
  }

  async getSession(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const session = sessionStore.getById(id);

    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', '会话不存在');
    }

    res.json({
      success: true,
      data: session
    });
  }

  async getAllSessions(_req: Request, res: Response): Promise<void> {
    const sessions = sessionStore.getAll();

    res.json({
      success: true,
      data: { sessions }
    });
  }
}

export const recorderController = new RecorderController();
export const exportController = new ExportController();
export const auditController = new AuditController();
export const sessionController = new SessionController();
