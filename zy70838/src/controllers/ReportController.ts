import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { reportService } from '../services/ReportService';
import { store } from '../models/Store';

export class ReportController {
  async exportToExcel(req: Request, res: Response) {
    try {
      const { reportId } = req.params;
      const { outputPath } = req.body;

      const result = await reportService.exportReportToExcel(reportId, outputPath);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '导出Excel失败',
        error: error.message
      });
    }
  }

  async downloadExcel(req: Request, res: Response) {
    try {
      const { reportId } = req.params;

      const result = await reportService.exportReportToExcel(reportId);

      const fileStream = fs.createReadStream(result.filePath);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);

      fileStream.pipe(res);

      fileStream.on('end', () => {
        fs.unlink(result.filePath, () => {});
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '下载Excel失败',
        error: error.message
      });
    }
  }

  async getTraceability(req: Request, res: Response) {
    try {
      const { recordId } = req.params;

      const result = reportService.getTraceabilityChain(recordId);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '获取追溯链路失败',
        error: error.message
      });
    }
  }

  async getAuditLog(req: Request, res: Response) {
    try {
      const { recordId } = req.params;

      const auditLog = reportService.getAuditLog(recordId);

      res.json({
        success: true,
        data: {
          auditLog,
          total: auditLog.length
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '获取审计日志失败',
        error: error.message
      });
    }
  }

  async getBorrowRecords(req: Request, res: Response) {
    try {
      const { vehiclePlate, borrower, page = 1, limit = 50 } = req.query;

      let records = store.getAllBorrowRecords();

      if (vehiclePlate) {
        records = records.filter(r => r.vehiclePlate.includes(vehiclePlate as string));
      }

      if (borrower) {
        records = records.filter(r => r.borrower.includes(borrower as string));
      }

      records.sort((a, b) => new Date(b.borrowTime).getTime() - new Date(a.borrowTime).getTime());

      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginated = records.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          records: paginated,
          total: records.length,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(records.length / Number(limit))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '获取借还记录失败',
        error: error.message
      });
    }
  }

  async getVehicles(req: Request, res: Response) {
    try {
      const { plateNumber, status, page = 1, limit = 50 } = req.query;

      let vehicles = store.getAllVehicles();

      if (plateNumber) {
        vehicles = vehicles.filter(v => v.plateNumber.includes(plateNumber as string));
      }

      if (status) {
        vehicles = vehicles.filter(v => v.status === status);
      }

      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginated = vehicles.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          vehicles: paginated,
          total: vehicles.length,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(vehicles.length / Number(limit))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '获取车辆列表失败',
        error: error.message
      });
    }
  }

  async getViolations(req: Request, res: Response) {
    try {
      const { vehiclePlate, status, page = 1, limit = 50 } = req.query;

      let violations = store.getAllViolations();

      if (vehiclePlate) {
        violations = violations.filter(v => v.vehiclePlate.includes(vehiclePlate as string));
      }

      if (status) {
        violations = violations.filter(v => v.status === status);
      }

      violations.sort((a, b) => new Date(b.violationTime).getTime() - new Date(a.violationTime).getTime());

      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginated = violations.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          violations: paginated,
          total: violations.length,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(violations.length / Number(limit))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '获取违章记录失败',
        error: error.message
      });
    }
  }
}

export const reportController = new ReportController();
