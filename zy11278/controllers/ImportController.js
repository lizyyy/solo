const importService = require('../services/ImportService');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

class ImportController {
  constructor() {
    this.upload = upload;
  }

  async importQuotesCSV(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传 CSV 文件'
        });
      }

      const { trading_day_id } = req.body;
      
      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const result = await importService.importQuotesFromCSV(req.file.path, trading_day_id);

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async importTradePlanJSON(req, res) {
    try {
      const { trading_day_id, plans } = req.body;
      
      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      if (!plans || (Array.isArray(plans) && plans.length === 0)) {
        return res.status(400).json({
          success: false,
          message: '交易计划数据不能为空'
        });
      }

      const result = await importService.importTradePlanFromJSON(plans, trading_day_id);

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

  async importTradePlanFromFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传 JSON 文件'
        });
      }

      const { trading_day_id } = req.body;
      
      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const result = await importService.importTradePlanFromFile(req.file.path, trading_day_id);

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getQuotes(req, res) {
    try {
      const { trading_day_id, symbol, page = 1, pageSize = 100 } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const result = await importService.getQuotesByTradingDay(trading_day_id, {
        symbol,
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

  async getQuoteBySymbol(req, res) {
    try {
      const { trading_day_id, symbol } = req.params;

      const quote = await importService.getQuoteBySymbol(trading_day_id, symbol);

      if (!quote) {
        return res.status(404).json({
          success: false,
          message: '行情数据不存在'
        });
      }

      res.json({
        success: true,
        data: quote
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getTradePlans(req, res) {
    try {
      const { trading_day_id, symbol, status, plan_type, page = 1, pageSize = 50 } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const result = await importService.getTradePlansByTradingDay(trading_day_id, {
        symbol,
        status,
        plan_type,
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

  async createTradePlan(req, res) {
    try {
      const { trading_day_id, symbol, name, plan_type, entry_price_min, entry_price_max, 
              target_price, stop_loss_price, planned_quantity, entry_reason, 
              exit_reason, risk_level, priority } = req.body;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }
      if (!symbol) {
        return res.status(400).json({
          success: false,
          message: '股票代码不能为空'
        });
      }

      const plan = await importService.createTradePlan({
        trading_day_id,
        symbol,
        name,
        plan_type: plan_type || 'watch',
        entry_price_min,
        entry_price_max,
        target_price,
        stop_loss_price,
        planned_quantity,
        entry_reason,
        exit_reason,
        risk_level: risk_level || 'medium',
        priority: priority || 0
      });

      res.json({
        success: true,
        data: plan
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateTradePlan(req, res) {
    try {
      const { id } = req.params;
      const { entry_price_min, entry_price_max, target_price, stop_loss_price, 
              planned_quantity, entry_reason, exit_reason, risk_level, 
              priority, status } = req.body;

      const plan = await importService.updateTradePlan(id, {
        entry_price_min,
        entry_price_max,
        target_price,
        stop_loss_price,
        planned_quantity,
        entry_reason,
        exit_reason,
        risk_level,
        priority,
        status
      });

      res.json({
        success: true,
        data: plan
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ImportController();
