import type { Request, Response } from 'express';
import { correctionService } from '../services/CorrectionService';
import { reportService } from '../services/ReportService';

export class CorrectionController {
  async createCorrection(req: Request, res: Response) {
    try {
      const result = await correctionService.createCorrection(req.body);
      res.status(201).json({
        success: true,
        message: '修正申请创建成功',
        data: {
          id: result.id,
          status: result.status,
          title: result.title
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '创建失败'
      });
    }
  }

  async getCorrection(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await correctionService.getCorrection(id);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: '修正申请不存在'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  }

  async listCorrections(req: Request, res: Response) {
    try {
      const { status, applicant, department } = req.query;
      const filters = {
        status: status as string | undefined,
        applicant: applicant as string | undefined,
        department: department as string | undefined
      };
      
      const results = await correctionService.listCorrections(filters);
      
      res.json({
        success: true,
        data: results,
        total: results.length
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  }

  async generatePreview(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await correctionService.generatePreview(id);
      
      res.json({
        success: true,
        message: '预览生成成功，请确认标签差异和成本影响后提交审批',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '预览生成失败'
      });
    }
  }

  async submitForApproval(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { approver } = req.body;
      
      const result = await correctionService.submitForApproval(id, approver);
      
      res.json({
        success: true,
        message: '已提交审批，请等待审批人处理',
        data: {
          id: result.id,
          status: result.status,
          approver: result.approver
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '提交失败'
      });
    }
  }

  async approveCorrection(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { approver, comment } = req.body;
      
      const result = await correctionService.approveCorrection(id, approver, comment);
      
      res.json({
        success: true,
        message: '审批通过，系统将自动执行标签修正',
        data: {
          id: result.id,
          status: result.status
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '审批失败'
      });
    }
  }

  async rejectCorrection(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { approver, comment } = req.body;
      
      const result = await correctionService.rejectCorrection(id, approver, comment);
      
      res.json({
        success: true,
        message: '已驳回申请，请根据审批意见调整后重新提交',
        data: {
          id: result.id,
          status: result.status
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '驳回失败'
      });
    }
  }

  async executeCorrection(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { operator } = req.body;
      
      const result = await correctionService.executeCorrection(id, operator);
      
      res.json({
        success: true,
        message: result.status === 'COMPLETED' 
          ? '标签修正执行完成' 
          : '执行过程中出现异常，请查看异常记录',
        data: {
          id: result.id,
          status: result.status
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '执行失败'
      });
    }
  }

  async rollbackCorrection(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { operator } = req.body;
      
      const result = await correctionService.rollbackCorrection(id, operator);
      
      res.json({
        success: true,
        message: '已回滚到修正前的标签状态',
        data: {
          id: result.id,
          status: result.status
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '回滚失败'
      });
    }
  }

  async manualFix(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const assetId = req.params.assetId as string;
      const { correctedTags, operator, reason } = req.body;
      
      const result = await correctionService.manualFix(id, assetId, correctedTags, operator, reason);
      
      res.json({
        success: true,
        message: '人工修正已记录，请重新预览后继续流程',
        data: {
          id: result.id,
          assetId
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '人工修正失败'
      });
    }
  }

  async resolveException(req: Request, res: Response) {
    try {
      const exceptionId = req.params.exceptionId as string;
      const { resolver, resolution } = req.body;
      
      const result = await correctionService.resolveException(exceptionId, resolver, resolution);
      
      res.json({
        success: true,
        message: '异常已标记为解决',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '处理失败'
      });
    }
  }

  async generateReport(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { generatedBy } = req.body;
      
      const result = await reportService.generateReport(id, generatedBy);
      
      res.json({
        success: true,
        message: '报告生成成功',
        data: {
          reportId: result.id,
          summary: result.summary
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '报告生成失败'
      });
    }
  }

  async exportReport(req: Request, res: Response) {
    try {
      const reportId = req.params.reportId as string;
      const format = req.query.format as string || 'markdown';
      
      const report = await reportService.getReport(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: '报告不存在'
        });
      }

      if (format === 'csv') {
        const csv = await reportService.exportToCSV(report);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="correction-report-${reportId}.csv"`);
        res.send('\uFEFF' + csv);
      } else {
        const markdown = await reportService.exportToMarkdown(report);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="correction-report-${reportId}.md"`);
        res.send(markdown);
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '导出失败'
      });
    }
  }

  async getReport(req: Request, res: Response) {
    try {
      const reportId = req.params.reportId as string;
      const result = await reportService.getReport(reportId);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: '报告不存在'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  }
}

export const correctionController = new CorrectionController();
