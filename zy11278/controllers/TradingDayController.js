const tradingDayService = require('../services/TradingDayService');
const positionService = require('../services/PositionService');
const db = require('../models');

class TradingDayController {
  async getCurrent(req, res) {
    try {
      const tradingDay = await tradingDayService.getCurrentTradingDay();
      res.json({
        success: true,
        data: tradingDay
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getActive(req, res) {
    try {
      const tradingDay = await tradingDayService.getActiveTradingDay();
      res.json({
        success: true,
        data: tradingDay
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const tradingDay = await tradingDayService.getTradingDayById(id);
      
      if (!tradingDay) {
        return res.status(404).json({
          success: false,
          message: '交易日不存在'
        });
      }

      res.json({
        success: true,
        data: tradingDay
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async list(req, res) {
    try {
      const { status, startDate, endDate, page = 1, pageSize = 30 } = req.query;
      
      const result = await tradingDayService.getTradingDays({
        status,
        startDate,
        endDate,
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

  async create(req, res) {
    try {
      const { date, initialCash } = req.body;
      
      if (!date) {
        return res.status(400).json({
          success: false,
          message: '日期不能为空'
        });
      }

      const tradingDay = await tradingDayService.getOrCreateTradingDay(date, initialCash);
      
      res.json({
        success: true,
        data: tradingDay
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async open(req, res) {
    try {
      const { date, initialCash } = req.body;
      
      if (!date) {
        return res.status(400).json({
          success: false,
          message: '日期不能为空'
        });
      }

      const tradingDay = await tradingDayService.openTradingDay(date, initialCash);
      
      res.json({
        success: true,
        data: tradingDay
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async close(req, res) {
    try {
      const { id } = req.params;
      
      const result = await tradingDayService.closeTradingDay(id);
      
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

  async review(req, res) {
    try {
      const { id } = req.params;
      const { summary } = req.body;
      
      const tradingDay = await tradingDayService.reviewTradingDay(id, summary);
      
      res.json({
        success: true,
        data: tradingDay
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getPortfolioSummary(req, res) {
    try {
      const { id } = req.params;
      
      const summary = await tradingDayService.getPortfolioSummary(id);
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new TradingDayController();
