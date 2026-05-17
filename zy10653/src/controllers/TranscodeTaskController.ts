import { Request, Response } from 'express';
import { TranscodeTaskService } from '../services/TranscodeTaskService';
import { ApiResponse } from '../types/api';
import { createObjectCsvStringifier } from 'csv-writer';

export class TranscodeTaskController {
  private service: TranscodeTaskService;

  constructor() {
    this.service = new TranscodeTaskService();
  }

  createTask = async (req: Request, res: Response) => {
    try {
      const task = await this.service.createTask(req.body);
      const response: ApiResponse = {
        success: true,
        data: task,
        message: '任务创建成功',
      };
      res.status(201).json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errorCode: error.message,
      };
      res.status(400).json(response);
    }
  };

  getTask = async (req: Request, res: Response) => {
    try {
      const task = await this.service.getTaskById(req.params.id);
      if (!task) {
        return res.status(404).json({
          success: false,
          message: '任务不存在',
          errorCode: 'TASK_NOT_FOUND',
        });
      }
      const response: ApiResponse = {
        success: true,
        data: task,
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  queryTasks = async (req: Request, res: Response) => {
    try {
      const result = await this.service.queryTasks(req.query);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  manualRetry = async (req: Request, res: Response) => {
    try {
      const result = await this.service.manualRetry(req.body);

      if (result.isDuplicate) {
        return res.status(200).json({
          success: true,
          data: result,
          message: '检测到重复重试请求，返回已存在的重试记录',
          isDuplicate: true,
        });
      }

      const response: ApiResponse = {
        success: true,
        data: result,
        message: '人工重试发起成功',
      };
      res.json(response);
    } catch (error: any) {
      const statusCode =
        error.message === 'TASK_NOT_FOUND' ? 404 : error.message === 'INVALID_STATUS_FOR_RETRY' ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        errorCode: error.message,
      });
    }
  };

  batchRetry = async (req: Request, res: Response) => {
    try {
      const result = await this.service.batchRetry(req.body);
      const response: ApiResponse = {
        success: true,
        data: result,
        message: '批量重试完成',
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  updateTaskStatus = async (req: Request, res: Response) => {
    try {
      const task = await this.service.updateTaskStatus(req.params.id, req.body);
      const response: ApiResponse = {
        success: true,
        data: task,
        message: '任务状态更新成功',
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  checkSourceFileChanged = async (req: Request, res: Response) => {
    try {
      const result = await this.service.checkSourceFileChanged(
        req.params.id,
        req.body.newFileHash
      );
      const response: ApiResponse = {
        success: true,
        data: result,
        message: result.changed ? '检测到源文件已变更' : '源文件未变更',
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  resolveConflict = async (req: Request, res: Response) => {
    try {
      const task = await this.service.resolveConflict(req.body);
      const response: ApiResponse = {
        success: true,
        data: task,
        message: '冲突解决成功',
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  getTaskHistory = async (req: Request, res: Response) => {
    try {
      const history = await this.service.getTaskHistory(req.params.id);
      const response: ApiResponse = {
        success: true,
        data: history,
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  getRowValidations = async (req: Request, res: Response) => {
    try {
      const validations = await this.service.getRowValidations(req.params.id);
      const response: ApiResponse = {
        success: true,
        data: validations,
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  getBadRows = async (req: Request, res: Response) => {
    try {
      const badRows = await this.service.getBadRows(req.params.id);
      const response: ApiResponse = {
        success: true,
        data: badRows,
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  exportTasks = async (req: Request, res: Response) => {
    try {
      const data = await this.service.exportTasks(req.query);
      const format = (req.query.format as string) || 'json';

      if (format === 'csv') {
        const csvStringifier = createObjectCsvStringifier({
          header: [
            { id: 'id', title: '任务ID' },
            { id: 'businessNo', title: '业务编号' },
            { id: 'fileName', title: '文件名' },
            { id: 'status', title: '状态' },
            { id: 'failureCode', title: '失败码' },
            { id: 'retryCount', title: '重试次数' },
            { id: 'isManuallyRetried', title: '是否人工重试' },
            { id: 'createdBy', title: '创建人' },
            { id: 'createdAt', title: '创建时间' },
          ],
        });

        const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(data);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=transcode_tasks.csv');
        res.send('\uFEFF' + csv);
      } else {
        res.json({
          success: true,
          data,
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
}
