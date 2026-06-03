import { Request, Response } from 'express';
import AdjustmentService from '../services/AdjustmentService';
import { TailAdjustmentCreate } from '../models';

class AdjustmentController {
  async getAllAdjustments(req: Request, res: Response) {
    try {
      const adjustments = AdjustmentService.getAllAdjustments();
      
      res.json({
        success: true,
        data: adjustments
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取尾差调整列表失败'
      });
    }
  }

  async getAdjustmentsByRecordId(req: Request, res: Response) {
    try {
      const { recordId } = req.params;
      const adjustments = AdjustmentService.getAdjustmentsByRecordId(recordId);
      
      res.json({
        success: true,
        data: adjustments
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取尾差调整失败'
      });
    }
  }

  async createAdjustment(req: Request, res: Response) {
    try {
      const data = req.body as TailAdjustmentCreate;
      
      if (!data.recordId || !data.amount || !data.reason || !data.adjustedBy) {
        return res.status(400).json({
          success: false,
          message: '请提供完整的尾差调整信息'
        });
      }

      const adjustment = AdjustmentService.createAdjustment(data);
      
      res.json({
        success: true,
        data: adjustment,
        message: '尾差调整已创建，关联记录的对账说明已自动更新'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '创建尾差调整失败'
      });
    }
  }

  async getAdjustmentImpact(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const impact = AdjustmentService.getAdjustmentWithRecordImpact(id);
      
      res.json({
        success: true,
        data: impact
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取调整影响分析失败'
      });
    }
  }

  async recalculateAll(req: Request, res: Response) {
    try {
      const results = AdjustmentService.recalculateAffectedRecords();
      
      res.json({
        success: true,
        data: results,
        message: `已重新计算${results.length}条受影响记录的对账说明`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '重新计算失败'
      });
    }
  }
}

export default new AdjustmentController();
