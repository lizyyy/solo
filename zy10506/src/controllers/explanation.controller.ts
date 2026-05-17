import { Request, Response } from 'express';
import { evaluationService } from '../services/evaluation.service';
import { exportService } from '../services/export.service';
import { CreateExplanationRequest, ManualCorrectionRequest, EvaluationStatus } from '../models/types';

class ExplanationController {
  async createExplanation(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateExplanationRequest = req.body;
      
      if (!request.flagName) {
        res.status(400).json({ error: '缺少必填参数: flagName' });
        return;
      }
      if (!request.tenantId) {
        res.status(400).json({ error: '缺少必填参数: tenantId' });
        return;
      }
      if (!request.environment) {
        res.status(400).json({ error: '缺少必填参数: environment' });
        return;
      }

      const report = await evaluationService.createExplanation(request);
      
      res.status(201).json({
        message: '解释报告创建成功',
        reportId: report.id,
        status: report.status,
        report
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      res.status(500).json({
        error: '创建解释报告失败',
        message: errorMessage
      });
    }
  }

  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const report = await evaluationService.getReport(reportId);
      
      if (!report) {
        res.status(404).json({ error: '报告不存在' });
        return;
      }

      res.status(200).json(report);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      res.status(500).json({
        error: '获取报告失败',
        message: errorMessage
      });
    }
  }

  async queryReports(req: Request, res: Response): Promise<void> {
    try {
      const {
        flagName,
        tenantId,
        userId,
        status,
        startDate,
        endDate,
        page = '1',
        pageSize = '20'
      } = req.query;

      const result = await evaluationService.queryReports({
        flagName: flagName as string,
        tenantId: tenantId as string,
        userId: userId as string,
        status: status as EvaluationStatus,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        page: parseInt(page as string, 10),
        pageSize: parseInt(pageSize as string, 10)
      });

      res.status(200).json({
        data: result.data,
        pagination: {
          page: parseInt(page as string, 10),
          pageSize: parseInt(pageSize as string, 10),
          total: result.total
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      res.status(500).json({
        error: '查询报告失败',
        message: errorMessage
      });
    }
  }

  async advanceStatus(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const { targetStatus } = req.body;

      if (!targetStatus) {
        res.status(400).json({ error: '缺少必填参数: targetStatus' });
        return;
      }

      const report = await evaluationService.advanceStatus(reportId, targetStatus as EvaluationStatus);

      res.status(200).json({
        message: '状态推进成功',
        report
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      if (errorMessage.includes('无效的状态转换')) {
        res.status(400).json({
          error: '状态推进失败',
          message: errorMessage
        });
      } else if (errorMessage.includes('报告不存在')) {
        res.status(404).json({ error: errorMessage });
      } else {
        res.status(500).json({
          error: '状态推进失败',
          message: errorMessage
        });
      }
    }
  }

  async manualCorrect(req: Request, res: Response): Promise<void> {
    try {
      const request: ManualCorrectionRequest = req.body;

      if (!request.reportId) {
        res.status(400).json({ error: '缺少必填参数: reportId' });
        return;
      }
      if (request.correctedValue === undefined) {
        res.status(400).json({ error: '缺少必填参数: correctedValue' });
        return;
      }
      if (!request.correctedBy) {
        res.status(400).json({ error: '缺少必填参数: correctedBy' });
        return;
      }
      if (!request.correctionReason) {
        res.status(400).json({ error: '缺少必填参数: correctionReason' });
        return;
      }

      const report = await evaluationService.manualCorrect(request);

      res.status(200).json({
        message: '人工修正成功',
        report
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      if (errorMessage.includes('报告不存在')) {
        res.status(404).json({ error: errorMessage });
      } else {
        res.status(500).json({
          error: '人工修正失败',
          message: errorMessage
        });
      }
    }
  }

  async exportReports(req: Request, res: Response): Promise<void> {
    try {
      const {
        format = 'json',
        flagName,
        tenantId,
        userId,
        status,
        startDate,
        endDate
      } = req.query;

      const result = await exportService.exportReports({
        format: format as 'csv' | 'json',
        flagName: flagName as string,
        tenantId: tenantId as string,
        userId: userId as string,
        status: status as EvaluationStatus,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      res.status(500).json({
        error: '导出报告失败',
        message: errorMessage
      });
    }
  }

  async exportSingleReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const { format = 'json' } = req.query;

      const result = await exportService.exportSingleReport(
        reportId,
        format as 'csv' | 'json'
      );

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      if (errorMessage.includes('报告不存在')) {
        res.status(404).json({ error: errorMessage });
      } else {
        res.status(500).json({
          error: '导出报告失败',
          message: errorMessage
        });
      }
    }
  }

  async getFlag(req: Request, res: Response): Promise<void> {
    try {
      const { flagName } = req.params;
      const flag = await evaluationService.getFlag(flagName);
      
      if (!flag) {
        res.status(404).json({ error: '功能开关不存在' });
        return;
      }

      res.status(200).json(flag);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      res.status(500).json({
        error: '获取功能开关失败',
        message: errorMessage
      });
    }
  }

  async getAllFlags(_req: Request, res: Response): Promise<void> {
    try {
      const flags = await evaluationService.getAllFlags();
      res.status(200).json({ data: flags, total: flags.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      res.status(500).json({
        error: '获取功能开关列表失败',
        message: errorMessage
      });
    }
  }
}

export const explanationController = new ExplanationController();
