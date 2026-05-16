import { Request, Response } from 'express';
import { cacheExplanationStore } from '../store/cacheExplanationStore';
import { exportService } from '../services/exportService';
import {
  CreateExplanationRequest,
  ManualCorrectionRequest,
  ForceRefreshRequest,
  QueryExplanationParams,
  CacheExplanationStatus
} from '../types';

export class CacheExplanationController {
  async createExplanation(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateExplanationRequest = req.body;
      const explanation = cacheExplanationStore.create(request);

      res.status(201).json({
        success: true,
        data: explanation,
        message: '缓存解释记录创建成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '创建缓存解释记录失败',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async getExplanationById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const explanation = cacheExplanationStore.findById(id);

    if (!explanation) {
      res.status(404).json({
        success: false,
        error: '未找到缓存解释记录'
      });
      return;
    }

    res.json({
      success: true,
      data: explanation
    });
  }

  async getExplanationByCacheKey(req: Request, res: Response): Promise<void> {
    const { cacheKey } = req.params;
    const explanation = cacheExplanationStore.findByCacheKey(cacheKey);

    if (!explanation) {
      res.status(404).json({
        success: false,
        error: '未找到对应缓存键的解释记录'
      });
      return;
    }

    res.json({
      success: true,
      data: explanation
    });
  }

  async queryExplanations(req: Request, res: Response): Promise<void> {
    try {
      const params: QueryExplanationParams = req.query as unknown as QueryExplanationParams;
      const result = cacheExplanationStore.query(params);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (params.pageSize || 20))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '查询缓存解释记录失败',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status, updatedBy } = req.body;

    if (!Object.values(CacheExplanationStatus).includes(status)) {
      res.status(400).json({
        success: false,
        error: '无效的状态值',
        validStatuses: Object.values(CacheExplanationStatus)
      });
      return;
    }

    const explanation = cacheExplanationStore.updateStatus(id, status, updatedBy);

    if (!explanation) {
      res.status(404).json({
        success: false,
        error: '未找到缓存解释记录'
      });
      return;
    }

    res.json({
      success: true,
      data: explanation,
      message: '状态更新成功'
    });
  }

  async manualCorrection(req: Request, res: Response): Promise<void> {
    try {
      const request: ManualCorrectionRequest = req.body;
      const explanation = cacheExplanationStore.manualCorrection(request);

      if (!explanation) {
        res.status(404).json({
          success: false,
          error: '未找到缓存解释记录'
        });
        return;
      }

      res.json({
        success: true,
        data: explanation,
        message: '人工修正成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '人工修正失败',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async recordHit(req: Request, res: Response): Promise<void> {
    const { cacheKey, requestId, clientIp } = req.body;
    const explanation = cacheExplanationStore.recordHit(cacheKey, requestId, clientIp);

    if (!explanation) {
      res.status(404).json({
        success: false,
        error: '未找到对应缓存键的解释记录'
      });
      return;
    }

    res.json({
      success: true,
      message: '命中记录已更新',
      hitCount: explanation.hitHistory.length
    });
  }

  async forceRefresh(req: Request, res: Response): Promise<void> {
    try {
      const request: ForceRefreshRequest = req.body;
      const explanation = cacheExplanationStore.forceRefresh(request);

      if (!explanation) {
        res.status(404).json({
          success: false,
          error: '未找到对应缓存键的解释记录'
        });
        return;
      }

      res.json({
        success: true,
        data: explanation,
        message: '缓存已强制刷新并标记为已撤销'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '强制刷新失败',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async recordFailure(req: Request, res: Response): Promise<void> {
    try {
      const { id, rawInput, processingBasis, finalConclusion, errorStack } = req.body;
      const explanation = cacheExplanationStore.recordFailure(
        id,
        rawInput,
        processingBasis,
        finalConclusion,
        errorStack
      );

      if (!explanation) {
        res.status(404).json({
          success: false,
          error: '未找到缓存解释记录'
        });
        return;
      }

      res.json({
        success: true,
        data: explanation,
        message: '失败详情已记录，状态已更新为被拦截'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '记录失败详情失败',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async getDetailedReport(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const explanation = cacheExplanationStore.findById(id);

    if (!explanation) {
      res.status(404).json({
        success: false,
        error: '未找到缓存解释记录'
      });
      return;
    }

    const report = exportService.generateDetailedReport(explanation);

    res.json({
      success: true,
      data: report
    });
  }

  async exportToCSV(req: Request, res: Response): Promise<void> {
    try {
      const explanations = cacheExplanationStore.getAllForExport();
      const filePath = exportService.exportToCSV(explanations);

      res.json({
        success: true,
        message: 'CSV导出成功',
        filePath,
        recordCount: explanations.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'CSV导出失败',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async exportToJSON(req: Request, res: Response): Promise<void> {
    try {
      const explanations = cacheExplanationStore.getAllForExport();
      const filePath = exportService.exportToJSON(explanations);

      res.json({
        success: true,
        message: 'JSON导出成功',
        filePath,
        recordCount: explanations.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'JSON导出失败',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async getHitHistory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const explanation = cacheExplanationStore.findById(id);

    if (!explanation) {
      res.status(404).json({
        success: false,
        error: '未找到缓存解释记录'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        hitHistory: explanation.hitHistory,
        totalHits: explanation.hitHistory.length
      }
    });
  }
}

export const cacheExplanationController = new CacheExplanationController();
