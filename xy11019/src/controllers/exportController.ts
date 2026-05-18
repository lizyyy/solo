import { Request, Response } from 'express';
import { exportService, ExportFilter } from '../services/exportService';
import { ApiResponse } from '../models/types';
import * as fs from 'fs';

export const exportController = {
  async exportJson(req: Request, res: Response) {
    try {
      const filter: ExportFilter = req.body;
      const result = await exportService.exportToJson(filter);

      const response: ApiResponse = {
        success: true,
        data: {
          filePath: result.filePath,
          count: result.count
        },
        message: `成功导出 ${result.count} 条授权记录`
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(500).json(response);
    }
  },

  async exportCsv(req: Request, res: Response) {
    try {
      const filter: ExportFilter = req.body;
      const result = await exportService.exportToCsv(filter);

      const response: ApiResponse = {
        success: true,
        data: {
          filePath: result.filePath,
          count: result.count
        },
        message: `成功导出 ${result.count} 条授权记录`
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(500).json(response);
    }
  },

  async listFiles(req: Request, res: Response) {
    try {
      const files = exportService.getExportFiles();

      const response: ApiResponse = {
        success: true,
        data: files,
        metadata: { total: files.length }
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(500).json(response);
    }
  },

  async downloadFile(req: Request, res: Response) {
    try {
      const { filename } = req.params;
      const filePath = exportService.getFilePath(filename);

      if (!fs.existsSync(filePath)) {
        const response: ApiResponse = {
          success: false,
          error: '文件不存在'
        };
        return res.status(404).json(response);
      }

      res.download(filePath);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(500).json(response);
    }
  }
};
