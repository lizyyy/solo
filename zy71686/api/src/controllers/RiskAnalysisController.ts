import type { Request, Response } from 'express';
import type { RiskAnalysisRequest, GraphRequest, DashboardStats } from '../../../shared/types.js';
import { riskAnalysisService } from '../services/RiskAnalysisService.js';

const DEFAULT_OPERATOR = 'system';

export class RiskAnalysisController {
  async analyze(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as RiskAnalysisRequest;
      const operator = req.headers['x-operator'] as string || DEFAULT_OPERATOR;

      const result = await riskAnalysisService.analyze(request, operator);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Risk analysis error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '风险分析失败'
      });
    }
  }

  getResults(req: Request, res: Response): void {
    try {
      const version = req.query.version as string | undefined;
      const riskLevel = req.query.riskLevel as string | undefined;
      
      const results = riskAnalysisService.getResults(version, riskLevel);
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Get risk results error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取风险分析结果失败'
      });
    }
  }

  getResultByCustomer(req: Request, res: Response): void {
    try {
      const { customerId } = req.params;
      const version = req.query.version as string | undefined;
      
      const result = riskAnalysisService.getResultByCustomer(customerId, version);
      
      if (!result) {
        res.status(404).json({
          success: false,
          error: '未找到该客户的风险分析结果'
        });
        return;
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get customer risk result error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取客户风险分析结果失败'
      });
    }
  }

  getGraph(req: Request, res: Response): void {
    try {
      const request: GraphRequest = {
        centerCustomerId: req.query.centerCustomerId as string | undefined,
        maxDepth: parseInt(req.query.maxDepth as string) || 3,
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        riskLevels: req.query.riskLevels ? (req.query.riskLevels as string).split(',') as any : undefined,
        version: req.query.version as string | undefined
      };

      const result = riskAnalysisService.getGraph(request);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get graph error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取图谱数据失败'
      });
    }
  }

  getDashboardStats(req: Request, res: Response): void {
    try {
      const stats = riskAnalysisService.getDashboardStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取仪表盘统计失败'
      });
    }
  }

  getBatchTask(req: Request, res: Response): void {
    try {
      const { taskId } = req.params;
      const task = riskAnalysisService.getBatchTask(taskId);
      
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

export const riskAnalysisController = new RiskAnalysisController();
