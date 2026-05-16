import { Request, Response } from 'express';
import { DatabaseService } from '../services/databaseService';
import { ValidationService } from '../services/validationService';
import { ExportService } from '../services/exportService';
import { RecalculationStatus } from '../types';

export class RecalculationController {
  private dbService: DatabaseService;
  private validationService: ValidationService;
  private exportService: ExportService;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
    this.validationService = new ValidationService();
    this.exportService = new ExportService();
  }

  createApplication = async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = this.validationService.validateCreateApplication(req.body);
      if (validation.error) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const existing = await this.dbService.findByIdempotencyKey(req.body.idempotencyKey);
      if (existing) {
        res.status(200).json({
          message: '重复申请，返回已有记录',
          data: existing,
          isDuplicate: true
        });
        return;
      }

      const application = await this.dbService.createApplication(req.body);
      res.status(201).json({
        message: '申请创建成功',
        data: application
      });
    } catch (error) {
      console.error('创建申请失败:', error);
      res.status(500).json({ error: '创建申请失败', details: (error as Error).message });
    }
  };

  getApplications = async (req: Request, res: Response): Promise<void> => {
    try {
      const { billingMonth, customerAccount, status, limit = 100, offset = 0 } = req.query;
      
      const applications = await this.dbService.getApplications(
        {
          billingMonth: billingMonth as string,
          customerAccount: customerAccount as string,
          status: status as string
        },
        Number(limit),
        Number(offset)
      );

      res.status(200).json({
        message: '查询成功',
        data: applications,
        total: applications.length
      });
    } catch (error) {
      console.error('查询申请列表失败:', error);
      res.status(500).json({ error: '查询申请列表失败', details: (error as Error).message });
    }
  };

  getApplicationById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const application = await this.dbService.getApplicationById(id);

      if (!application) {
        res.status(404).json({ error: '申请不存在' });
        return;
      }

      res.status(200).json({
        message: '查询成功',
        data: application
      });
    } catch (error) {
      console.error('查询申请详情失败:', error);
      res.status(500).json({ error: '查询申请详情失败', details: (error as Error).message });
    }
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const validation = this.validationService.validateUpdateStatus(req.body);
      
      if (validation.error) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const application = await this.dbService.getApplicationById(id);
      if (!application) {
        res.status(404).json({ error: '申请不存在' });
        return;
      }

      if (!this.validationService.validateStatusTransition(application.status, req.body.status)) {
        res.status(400).json({
          error: '无效的状态转换',
          currentStatus: application.status,
          requestedStatus: req.body.status
        });
        return;
      }

      await this.dbService.updateStatus(id, req.body);

      const updatedApplication = await this.dbService.getApplicationById(id);
      res.status(200).json({
        message: '状态更新成功',
        data: updatedApplication
      });
    } catch (error) {
      console.error('更新状态失败:', error);
      res.status(500).json({ error: '更新状态失败', details: (error as Error).message });
    }
  };

  getApprovalHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const history = await this.dbService.getApprovalHistory(id);

      res.status(200).json({
        message: '查询成功',
        data: history
      });
    } catch (error) {
      console.error('查询审批历史失败:', error);
      res.status(500).json({ error: '查询审批历史失败', details: (error as Error).message });
    }
  };

  getSnapshots = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const snapshots = await this.dbService.getSnapshots(id);

      res.status(200).json({
        message: '查询成功',
        data: snapshots
      });
    } catch (error) {
      console.error('查询快照失败:', error);
      res.status(500).json({ error: '查询快照失败', details: (error as Error).message });
    }
  };

  markAsFailed = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { failureReason, processingBasis, finalConclusion } = req.body;

      if (!failureReason || !processingBasis || !finalConclusion) {
        res.status(400).json({ error: '失败原因、处理依据和最终结论是必填项' });
        return;
      }

      const application = await this.dbService.getApplicationById(id);
      if (!application) {
        res.status(404).json({ error: '申请不存在' });
        return;
      }

      await this.dbService.markAsFailed(id, failureReason, processingBasis, finalConclusion);

      const updatedApplication = await this.dbService.getApplicationById(id);
      res.status(200).json({
        message: '标记为失败成功',
        data: updatedApplication
      });
    } catch (error) {
      console.error('标记失败失败:', error);
      res.status(500).json({ error: '标记失败失败', details: (error as Error).message });
    }
  };

  applyManualCorrection = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const validation = this.validationService.validateManualCorrection(req.body);

      if (validation.error) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const application = await this.dbService.getApplicationById(id);
      if (!application) {
        res.status(404).json({ error: '申请不存在' });
        return;
      }

      if (application.status !== RecalculationStatus.NEEDS_MANUAL_CORRECTION) {
        res.status(400).json({
          error: '只有需要人工修正状态的申请才能进行修正',
          currentStatus: application.status
        });
        return;
      }

      await this.dbService.applyManualCorrection(id, req.body);

      const updatedApplication = await this.dbService.getApplicationById(id);
      res.status(200).json({
        message: '人工修正成功',
        data: updatedApplication
      });
    } catch (error) {
      console.error('人工修正失败:', error);
      res.status(500).json({ error: '人工修正失败', details: (error as Error).message });
    }
  };

  completeApplication = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { finalConclusion } = req.body;

      if (!finalConclusion) {
        res.status(400).json({ error: '最终结论是必填项' });
        return;
      }

      const application = await this.dbService.getApplicationById(id);
      if (!application) {
        res.status(404).json({ error: '申请不存在' });
        return;
      }

      const reportPath = await this.exportService.exportReport(application);
      await this.dbService.completeApplication(id, finalConclusion, reportPath);

      const updatedApplication = await this.dbService.getApplicationById(id);
      res.status(200).json({
        message: '重算完成',
        data: updatedApplication
      });
    } catch (error) {
      console.error('完成申请失败:', error);
      res.status(500).json({ error: '完成申请失败', details: (error as Error).message });
    }
  };

  exportApplications = async (req: Request, res: Response): Promise<void> => {
    try {
      const { billingMonth, status } = req.query;
      
      const applications = await this.dbService.getAllApplicationsForExport({
        billingMonth: billingMonth as string,
        status: status as string
      });

      const filePath = await this.exportService.exportToCSV(applications);

      res.status(200).json({
        message: '导出成功',
        filePath,
        exportCount: applications.length
      });
    } catch (error) {
      console.error('导出失败:', error);
      res.status(500).json({ error: '导出失败', details: (error as Error).message });
    }
  };
}