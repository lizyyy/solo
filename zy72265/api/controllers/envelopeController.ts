import { Request, Response } from 'express';
import { envelopeService } from '../services/envelopeService';
import type { ProcessingStatus, ImportLogRequest, ReviewPointRequest } from '../../shared/types';

export const envelopeController = {
  async getEnvelopes(req: Request, res: Response): Promise<void> {
    try {
      const { status, robotArmId } = req.query;
      const envelopes = await envelopeService.getAllEnvelopes(
        status as ProcessingStatus | undefined,
        robotArmId as string | undefined
      );
      
      res.json({
        success: true,
        data: envelopes,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '获取列表失败',
      });
    }
  },

  async getEnvelopeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const envelope = await envelopeService.getEnvelopeById(id);
      
      if (!envelope) {
        res.status(404).json({
          success: false,
          data: null,
          message: '记录不存在',
        });
        return;
      }
      
      const points = await envelopeService.getEnvelopePoints(id);
      const auditLogs = await envelopeService.getEnvelopeAuditLogs(id);
      const workflowSteps = envelopeService.getWorkflowSteps(envelope.currentStep);
      
      res.json({
        success: true,
        data: {
          envelope,
          points,
          auditLogs,
          workflowSteps,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '获取详情失败',
      });
    }
  },

  async importLog(req: Request, res: Response): Promise<void> {
    try {
      const { robotArmId, safetyRadiusVersion, fileContent, createdBy } = req.body as ImportLogRequest;
      
      if (!robotArmId || !safetyRadiusVersion || !fileContent || !createdBy) {
        res.status(400).json({
          success: false,
          data: null,
          message: '缺少必要参数',
        });
        return;
      }
      
      const result = await envelopeService.importPointCloudLog({
        robotArmId,
        safetyRadiusVersion,
        fileContent,
        createdBy,
      });
      
      res.json({
        success: true,
        data: result,
        message: `导入成功，共${result.points.length}条记录，其中${result.mixedCount}条为坐标混合`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '导入失败',
      });
    }
  },

  async advanceWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { operator } = req.body as { operator: string };
      
      if (!operator) {
        res.status(400).json({
          success: false,
          data: null,
          message: '缺少操作人信息',
        });
        return;
      }
      
      const envelope = await envelopeService.advanceWorkflow(id, operator);
      
      if (!envelope) {
        res.status(404).json({
          success: false,
          data: null,
          message: '记录不存在',
        });
        return;
      }
      
      res.json({
        success: true,
        data: envelope,
        message: `流程已推进到第${envelope.currentStep}步`,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '流程推进失败',
      });
    }
  },

  async reviewPoint(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const request = req.body as ReviewPointRequest;
      
      request.pointId = id;
      
      if (!request.action || !request.operator || !request.remark) {
        res.status(400).json({
          success: false,
          data: null,
          message: '缺少必要参数',
        });
        return;
      }
      
      const point = await envelopeService.reviewPoint(request);
      
      if (!point) {
        res.status(404).json({
          success: false,
          data: null,
          message: '坐标点不存在',
        });
        return;
      }
      
      res.json({
        success: true,
        data: point,
        message: '复核完成',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '复核失败',
      });
    }
  },

  async confirmNormalPoint(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { operator } = req.body as { operator: string };
      
      if (!operator) {
        res.status(400).json({
          success: false,
          data: null,
          message: '缺少操作人信息',
        });
        return;
      }
      
      const point = await envelopeService.confirmNormalPoint(id, operator);
      
      if (!point) {
        res.status(404).json({
          success: false,
          data: null,
          message: '坐标点不存在',
        });
        return;
      }
      
      res.json({
        success: true,
        data: point,
        message: '确认完成',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '确认失败',
      });
    }
  },

  async exportEnvelope(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const csvContent = await envelopeService.exportEnvelope(id);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="envelope_${id}.csv"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send('\uFEFF' + csvContent);
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '导出失败',
      });
    }
  },

  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const auditLogs = await envelopeService.getEnvelopeAuditLogs(id);
      
      res.json({
        success: true,
        data: auditLogs,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '获取审计日志失败',
      });
    }
  },

  async getBoundaryRules(req: Request, res: Response): Promise<void> {
    try {
      const rules = await envelopeService.getAllBoundaryRules();
      
      res.json({
        success: true,
        data: rules,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '获取边界规则失败',
      });
    }
  },

  async updateBoundaryRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const rule = await envelopeService.updateBoundaryRule(id, updates);
      
      if (!rule) {
        res.status(404).json({
          success: false,
          data: null,
          message: '规则不存在',
        });
        return;
      }
      
      res.json({
        success: true,
        data: rule,
        message: '规则更新成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '更新规则失败',
      });
    }
  },

  async getSafetyRadiusTable(req: Request, res: Response): Promise<void> {
    try {
      const { version, armModel } = req.query;
      const table = await envelopeService.getSafetyRadiusTable(
        version as string | undefined,
        armModel as string | undefined
      );
      
      res.json({
        success: true,
        data: table,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        message: error instanceof Error ? error.message : '获取安全半径表失败',
      });
    }
  },
};
