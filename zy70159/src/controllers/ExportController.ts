import { Request, Response } from 'express';
import ExportService from '../services/ExportService';
import ApprovalService from '../services/ApprovalService';
import ExceptionService from '../services/ExceptionService';
import SensitiveFieldService from '../services/SensitiveFieldService';
import { successResponse, errorResponse } from '../utils/response';

class ExportController {
  async createExportRequest(req: Request, res: Response): Promise<void> {
    try {
      const result = await ExportService.createExportRequest(req.body);

      if (result.success) {
        res.json(
          successResponse(
            {
              requestId: result.request?.id,
              needSpecialApproval: result.needSpecialApproval,
              approvalFlow: result.flowRecords,
            },
            result.message
          )
        );
      } else {
        res.json(errorResponse('CREATE_FAILED', result.message));
      }
    } catch (error) {
      res.json(
        errorResponse(
          'SYSTEM_ERROR',
          `系统异常：${(error as Error).message}`,
          { error: (error as Error).message }
        )
      );
    }
  }

  async getRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const request = await ExportService.getRequestById(id);

      if (!request) {
        res.json(errorResponse('NOT_FOUND', '导出申请不存在'));
        return;
      }

      res.json(successResponse(request, '查询成功'));
    } catch (error) {
      res.json(errorResponse('SYSTEM_ERROR', `查询失败：${(error as Error).message}`));
    }
  }

  async approveRequest(req: Request, res: Response): Promise<void> {
    try {
      const result = await ApprovalService.approveRequest(req.body);

      if (result.success) {
        res.json(
          successResponse(
            {
              allApproved: result.allApproved,
              requestId: req.body.requestId,
            },
            result.message
          )
        );
      } else {
        res.json(errorResponse('APPROVE_FAILED', result.message));
      }
    } catch (error) {
      res.json(errorResponse('SYSTEM_ERROR', `审批异常：${(error as Error).message}`));
    }
  }

  async rejectRequest(req: Request, res: Response): Promise<void> {
    try {
      const result = await ApprovalService.rejectRequest(req.body);

      if (result.success) {
        res.json(successResponse({ requestId: req.body.requestId }, result.message));
      } else {
        res.json(errorResponse('REJECT_FAILED', result.message));
      }
    } catch (error) {
      res.json(errorResponse('SYSTEM_ERROR', `驳回异常：${(error as Error).message}`));
    }
  }

  async processApprovedRequest(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.body;
      const result = await ExportService.processApprovedRequest(requestId);

      if (result.success) {
        res.json(
          successResponse(
            {
              downloadUrl: result.downloadUrl,
              expiryTime: result.expiryTime,
            },
            result.message
          )
        );
      } else {
        res.json(errorResponse('PROCESS_FAILED', result.message));
      }
    } catch (error) {
      res.json(errorResponse('SYSTEM_ERROR', `处理异常：${(error as Error).message}`));
    }
  }

  async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { requesterId } = req.body;

      const clientInfo = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      };

      const result = await ExportService.downloadFile(id, requesterId, clientInfo);

      if (result.success && result.fileContent) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${result.fileName || 'export.csv'}"`
        );
        res.send(result.fileContent);
      } else {
        res.json(errorResponse('DOWNLOAD_FAILED', result.message));
      }
    } catch (error) {
      res.json(errorResponse('SYSTEM_ERROR', `下载异常：${(error as Error).message}`));
    }
  }

  async getTaskReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await ExportService.generateTaskReport(id);

      if (result.success && result.report) {
        res.json(successResponse(result.report, result.message));
      } else {
        res.json(errorResponse('REPORT_FAILED', result.message));
      }
    } catch (error) {
      res.json(errorResponse('SYSTEM_ERROR', `生成报告异常：${(error as Error).message}`));
    }
  }

  async getPendingExceptions(req: Request, res: Response): Promise<void> {
    try {
      const exceptions = await ExceptionService.getPendingExceptions();
      res.json(
        successResponse(exceptions, `共找到 ${exceptions.length} 条待处理异常`)
      );
    } catch (error) {
      res.json(errorResponse('SYSTEM_ERROR', `查询异常列表失败：${(error as Error).message}`));
    }
  }

  async getAllExceptions(req: Request, res: Response): Promise<void> {
    try {
      const exceptions = await ExceptionService.getAllExceptions();
      res.json(
        successResponse(exceptions, `共找到 ${exceptions.length} 条异常记录`)
      );
    } catch (error) {
      res.json(errorResponse('SYSTEM_ERROR', `查询异常列表失败：${(error as Error).message}`));
    }
  }

  async processException(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { processorId, action } = req.body;

      const exception = await ExceptionService.processException(id, processorId, action);

      if (!exception) {
        res.json(errorResponse('NOT_FOUND', '异常记录不存在'));
        return;
      }

      res.json(
        successResponse(
          exception,
          action === 'processed' ? '异常已处理完成' : '异常已忽略'
        )
      );
    } catch (error) {
      res.json(errorResponse('SYSTEM_ERROR', `处理异常失败：${(error as Error).message}`));
    }
  }

  async getSensitiveFields(req: Request, res: Response): Promise<void> {
    try {
      const fields = await SensitiveFieldService.getAllSensitiveFields();
      res.json(
        successResponse(fields, `共定义 ${fields.length} 个敏感字段`)
      );
    } catch (error) {
      res.json(errorResponse('SYSTEM_ERROR', `查询敏感字段失败：${(error as Error).message}`));
    }
  }

  async createSensitiveField(req: Request, res: Response): Promise<void> {
    try {
      const field = await SensitiveFieldService.createSensitiveField(req.body);
      res.json(successResponse(field, `敏感字段 ${field.fieldName} 创建成功`));
    } catch (error) {
      res.json(errorResponse('CREATE_FAILED', (error as Error).message));
    }
  }
}

export default new ExportController();
