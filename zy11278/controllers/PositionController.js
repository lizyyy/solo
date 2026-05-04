const positionService = require('../services/PositionService');
const db = require('../models');

class PositionController {
  async getPositions(req, res) {
    try {
      const { trading_day_id, symbol, direction, page = 1, pageSize = 100 } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const result = await positionService.getPositionsByTradingDay(trading_day_id, {
        symbol,
        direction,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getAllPositions(req, res) {
    try {
      const { trading_day_id } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const positions = await positionService.getAllPositionsByTradingDay(trading_day_id);

      res.json({
        success: true,
        data: positions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getPortfolioMetrics(req, res) {
    try {
      const { trading_day_id } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const metrics = await positionService.calculatePortfolioMetrics(trading_day_id);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateTradingDayMetrics(req, res) {
    try {
      const { trading_day_id } = req.params;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const metrics = await positionService.updateTradingDayMetrics(trading_day_id);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getCashAccount(req, res) {
    try {
      const { trading_day_id } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const cashAccount = await db.CashAccount.findOne({
        where: {
          trading_day_id,
          account_type: 'main'
        }
      });

      res.json({
        success: true,
        data: cashAccount
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new PositionController();
