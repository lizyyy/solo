import { Request, Response } from 'express';
import { importService } from '../services/ImportService';

export class ImportController {
  async importBorrowRecords(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传CSV文件'
        });
      }

      const result = await importService.importBorrowRecordsFromCSV(req.file.path);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '导入借还记录失败',
        error: error.message
      });
    }
  }

  async importVehicles(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传JSON文件'
        });
      }

      const result = await importService.importVehiclesFromJSON(req.file.path);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '导入车辆信息失败',
        error: error.message
      });
    }
  }

  async importViolations(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传JSON文件'
        });
      }

      const result = await importService.importViolationsFromJSON(req.file.path);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '导入违章记录失败',
        error: error.message
      });
    }
  }
}

export const importController = new ImportController();
