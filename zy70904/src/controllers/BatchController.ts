import { Request, Response } from 'express';
import batchService from '../services/BatchService';
import exportService from '../services/ExportService';
import recordService from '../services/RecordService';
import dataStore from '../models/DataStore';
import { FileParser } from '../utils/FileParser';
import { MemberLevel, RecordStatus, QueryParams } from '../types';

export class BatchController {
  static async createBatch(req: Request, res: Response) {
    try {
      const { name, activityCode, storeCode, operator } = req.body;
      
      if (!name || !activityCode || !storeCode || !operator) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：name, activityCode, storeCode, operator'
        });
      }

      const batch = batchService.createBatch(name, activityCode, storeCode, operator);
      
      res.json({
        success: true,
        data: batch
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async processBatch(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const { receipts, members, activityCode, operator } = req.body;
      
      const activityRule = dataStore.getActivityRule(activityCode);
      if (!activityRule) {
        return res.status(404).json({
          success: false,
          message: '活动规则不存在'
        });
      }

      const parsedReceipts = FileParser.parseReceiptsFromJSON(receipts);
      const parsedMembers = FileParser.parseMembersFromJSON(members);

      const result = batchService.processBatch(
        batchId,
        parsedReceipts,
        parsedMembers,
        activityRule,
        operator
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static approveRecord(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const { operator, reason } = req.body;
      
      if (!operator || !reason) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：operator, reason'
        });
      }

      const record = batchService.approveRecord(recordId, operator, reason);
      
      res.json({
        success: true,
        data: record
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static rejectRecord(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const { operator, reason } = req.body;
      
      if (!operator || !reason) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：operator, reason'
        });
      }

      const record = batchService.rejectRecord(recordId, operator, reason);
      
      res.json({
        success: true,
        data: record
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static returnRecord(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const { operator, reason } = req.body;
      
      if (!operator || !reason) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：operator, reason'
        });
      }

      const record = batchService.returnRecord(recordId, operator, reason);
      
      res.json({
        success: true,
        data: record
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static getBatch(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const batch = batchService.getBatch(batchId);
      
      if (!batch) {
        return res.status(404).json({
          success: false,
          message: '批次不存在'
        });
      }

      res.json({
        success: true,
        data: batch
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static getAllBatches(req: Request, res: Response) {
    try {
      const batches = batchService.getAllBatches();
      
      res.json({
        success: true,
        data: batches
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static getBatchRecords(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const records = batchService.getBatchRecords(batchId);
      
      res.json({
        success: true,
        data: records
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static getBatchStats(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const stats = batchService.getBatchStats(batchId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static getRecordExplanation(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const explanation = recordService.getDecisionExplanation(recordId);
      
      res.json({
        success: true,
        data: { explanation }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static getRecordAuditTrail(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const auditTrail = recordService.getRecordAuditTrail(recordId);
      
      res.json({
        success: true,
        data: auditTrail
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static queryRecords(req: Request, res: Response) {
    try {
      const {
        memberLevel,
        receiptNo,
        activityCode,
        startDate,
        endDate,
        status,
        storeCode,
        page,
        pageSize
      } = req.query;

      const params: QueryParams = {
        memberLevel: memberLevel as MemberLevel,
        receiptNo: receiptNo as string,
        activityCode: activityCode as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        status: status as RecordStatus,
        storeCode: storeCode as string,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined
      };

      const result = dataStore.queryProcessingRecords(params);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static exportBatchRecords(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const { operator } = req.query;
      
      const result = exportService.exportBatchRecords(batchId, operator as string);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="batch_${batchId}.csv"`);
      res.send('\uFEFF' + result.csv);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static exportRecords(req: Request, res: Response) {
    try {
      const {
        memberLevel,
        receiptNo,
        activityCode,
        startDate,
        endDate,
        status,
        storeCode,
        operator
      } = req.query;

      const params: QueryParams = {
        memberLevel: memberLevel as MemberLevel,
        receiptNo: receiptNo as string,
        activityCode: activityCode as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        status: status as RecordStatus,
        storeCode: storeCode as string
      };

      const result = exportService.exportRecordsWithQuery(params, operator as string);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="records_${Date.now()}.csv"`);
      res.send('\uFEFF' + result.csv);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static getOperationLogs(req: Request, res: Response) {
    try {
      const { recordId, batchId } = req.query;
      const logs = dataStore.getOperationLogs(recordId as string, batchId as string);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static createActivityRule(req: Request, res: Response) {
    try {
      const rule = {
        id: dataStore.generateId(),
        ...req.body,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime)
      };
      
      dataStore.saveActivityRule(rule);
      
      res.json({
        success: true,
        data: rule
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static getAllActivityRules(req: Request, res: Response) {
    try {
      const rules = dataStore.getAllActivityRules();
      
      res.json({
        success: true,
        data: rules
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
