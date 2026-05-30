import type { Request, Response } from 'express';
import type { ImportRequest, ImportPreviewResponse, ImportBatch, DataImportWarning, BatchTask } from '../../../shared/types.js';
import { dataImportService } from '../services/DataImportService.js';

const DEFAULT_OPERATOR = 'system';

export class DataImportController {
  async previewImport(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as ImportRequest;
      if (!request.files || request.files.length === 0) {
        res.status(400).json({
          success: false,
          error: '请选择要导入的文件'
        });
        return;
      }

      const result = await dataImportService.previewImport(request);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Preview import error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '预览导入失败'
      });
    }
  }

  async executeImport(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as ImportRequest;
      const operator = req.headers['x-operator'] as string || DEFAULT_OPERATOR;

      if (!request.files || request.files.length === 0) {
        res.status(400).json({
          success: false,
          error: '请选择要导入的文件'
        });
        return;
      }

      if (request.createNewVersion && !request.versionName) {
        res.status(400).json({
          success: false,
          error: '创建新版本时请填写版本名称'
        });
        return;
      }

      const result = await dataImportService.executeImport(request, operator);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Execute import error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '执行导入失败'
      });
    }
  }

  getImportBatch(req: Request, res: Response): void {
    try {
      const { batchId } = req.params;
      const batch = dataImportService.getImportBatch(batchId);
      
      if (!batch) {
        res.status(404).json({
          success: false,
          error: '导入批次不存在'
        });
        return;
      }

      res.json({
        success: true,
        data: batch
      });
    } catch (error) {
      console.error('Get import batch error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取导入批次失败'
      });
    }
  }

  listImportBatches(req: Request, res: Response): void {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const batches = dataImportService.listImportBatches(limit);
      
      res.json({
        success: true,
        data: batches
      });
    } catch (error) {
      console.error('List import batches error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取导入批次列表失败'
      });
    }
  }

  getBatchWarnings(req: Request, res: Response): void {
    try {
      const { batchId } = req.params;
      const warnings = dataImportService.getBatchWarnings(batchId);
      
      res.json({
        success: true,
        data: warnings
      });
    } catch (error) {
      console.error('Get batch warnings error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取批次警告失败'
      });
    }
  }

  getBatchTask(req: Request, res: Response): void {
    try {
      const { taskId } = req.params;
      const task = dataImportService.getBatchTask(taskId);
      
      if (!task) {
        res.status(404).json({
          success: false,
          error: '任务不存在'
        });
        return;
      }

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Get batch task error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取任务状态失败'
      });
    }
  }
}

export const dataImportController = new DataImportController();
