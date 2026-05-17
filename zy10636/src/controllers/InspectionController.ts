import { Request, Response } from 'express';
import { InspectionService } from '../services/InspectionService';
import { ExportService } from '../services/ExportService';
import { InspectionStatus, FlowType } from '../types';

export class InspectionController {
  static async createMissedRecord(req: Request, res: Response) {
    const result = await InspectionService.createMissedRecord(req.body);
    res.status(result.success ? 200 : 400).json(result);
  }

  static async submitSupplement(req: Request, res: Response) {
    const result = await InspectionService.submitSupplement({
      ...req.body,
      recordId: req.params.id
    });
    res.status(result.success ? 200 : 400).json(result);
  }

  static async confirmRecord(req: Request, res: Response) {
    const result = await InspectionService.confirmRecord({
      ...req.body,
      recordId: req.params.id
    });
    res.status(result.success ? 200 : 400).json(result);
  }

  static async rejectRecord(req: Request, res: Response) {
    const result = await InspectionService.rejectRecord({
      ...req.body,
      recordId: req.params.id
    });
    res.status(result.success ? 200 : 400).json(result);
  }

  static async approveManualReview(req: Request, res: Response) {
    const result = await InspectionService.approveManualReview({
      ...req.body,
      recordId: req.params.id
    });
    res.status(result.success ? 200 : 400).json(result);
  }

  static async getRecordDetail(req: Request, res: Response) {
    const result = await InspectionService.getRecordDetail(req.params.id);
    res.status(result.success ? 200 : 404).json(result);
  }

  static async getRecordList(req: Request, res: Response) {
    const { status, flowType, page, pageSize } = req.query;
    const result = await InspectionService.getRecordList({
      status: status as InspectionStatus,
      flowType: flowType as FlowType,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined
    });
    res.status(result.success ? 200 : 400).json(result);
  }

  static async getOperationHistory(req: Request, res: Response) {
    const result = await InspectionService.getOperationHistory(req.params.id);
    res.status(result.success ? 200 : 404).json(result);
  }

  static async exportRecords(req: Request, res: Response) {
    try {
      const { status, flowType } = req.query;
      const csv = await ExportService.exportRecordsToCSV({
        status: status as string,
        flowType: flowType as string
      });
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inspection_records_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `导出失败: ${(error as Error).message}`
      });
    }
  }

  static async exportRecordDetail(req: Request, res: Response) {
    try {
      const csv = await ExportService.exportRecordDetailToCSV(req.params.id);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inspection_record_${req.params.id.substring(0, 8)}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `导出失败: ${(error as Error).message}`
      });
    }
  }

  static async importRecords(req: Request, res: Response) {
    try {
      const { records, operatorId, operatorName } = req.body;
      
      const success: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        try {
          if (!record.deviceId || !record.inspectorId || !record.planDate || !record.supplementReason || !record.discoveredDate) {
            throw new Error('缺少必填字段');
          }

          if (new Date(record.discoveredDate) < new Date(record.planDate)) {
            throw new Error('发现时间不能早于计划巡检时间');
          }

          const result = await InspectionService.createMissedRecord({
            ...record,
            planId: record.planId || 'plan_' + Date.now() + '_' + i,
            createdBy: operatorId,
            createdByName: operatorName
          });

          if (result.success && result.data) {
            success.push({
              row: i + 1,
              recordId: result.data.id,
              data: record
            });
          } else {
            throw new Error(result.message);
          }
        } catch (error) {
          errors.push({
            row: i + 1,
            data: record,
            message: (error as Error).message
          });
        }
      }

      res.json({
        success: true,
        data: {
          successCount: success.length,
          failCount: errors.length,
          success,
          errors
        },
        message: `导入完成：成功 ${success.length} 条，失败 ${errors.length} 条`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `导入失败: ${(error as Error).message}`
      });
    }
  }
}
