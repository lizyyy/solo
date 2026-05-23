const LossCalculationService = require('../services/lossCalculationService');
const logger = require('../config/logger');

class LossController {
  static async calculateBadFruit(req, res) {
    try {
      const { basketReturnId, simulateError } = req.body;
      
      if (!basketReturnId) {
        return res.status(400).json({ error: '请提供退筐记录ID' });
      }

      const lossRecord = await LossCalculationService.calculateBadFruitLoss(
        basketReturnId,
        { simulateError }
      );

      res.json({ success: true, data: lossRecord });
    } catch (error) {
      logger.error('计算坏果损耗失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async calculateSecondarySorting(req, res) {
    try {
      const { weighingRecordId } = req.body;
      
      if (!weighingRecordId) {
        return res.status(400).json({ error: '请提供称重记录ID' });
      }

      const lossRecord = await LossCalculationService.calculateSecondarySortingLoss(
        weighingRecordId
      );

      res.json({ success: true, data: lossRecord });
    } catch (error) {
      logger.error('计算二次分拣损耗失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async processDelivery(req, res) {
    try {
      const { deliveryNo } = req.params;
      
      if (!deliveryNo) {
        return res.status(400).json({ error: '请提供送货单号' });
      }

      const result = await LossCalculationService.processDeliveryMatching(deliveryNo);

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('处理送货单失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getLossRecord(req, res) {
    try {
      const { id } = req.params;
      const record = await LossCalculationService.getLossById(id);
      
      if (!record) {
        return res.status(404).json({ error: '损耗记录不存在' });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      logger.error('获取损耗记录失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async listLossRecords(req, res) {
    try {
      const result = await LossCalculationService.getLossRecords(req.query);
      res.json({
        success: true,
        data: {
          list: result.rows,
          total: result.count,
          page: parseInt(req.query.page) || 1,
          pageSize: parseInt(req.query.pageSize) || 20,
        },
      });
    } catch (error) {
      logger.error('获取损耗记录列表失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getLossSummary(req, res) {
    try {
      const summary = await LossCalculationService.getLossSummary(req.query);
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error('获取损耗汇总失败:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = LossController;
