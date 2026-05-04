const tradingService = require('../services/TradingService');
const orderService = require('../services/OrderService');
const db = require('../models');

class TradingController {
  async executeBuy(req, res) {
    try {
      const { trading_day_id, symbol, name, price, quantity, trade_plan_id, remark, order_subtype } = req.body;
      
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
      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: '委托数量必须大于0'
        });
      }
      if (!order_subtype || order_subtype !== 'market') {
        if (!price || price <= 0) {
          return res.status(400).json({
            success: false,
            message: '委托价格必须大于0'
          });
        }
      }

      const result = await tradingService.executeBuy({
        trading_day_id,
        symbol,
        name,
        price,
        quantity,
        trade_plan_id,
        remark,
        order_subtype: order_subtype || 'limit'
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

  async executeSell(req, res) {
    try {
      const { trading_day_id, symbol, name, price, quantity, trade_plan_id, remark, order_subtype } = req.body;
      
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
      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: '委托数量必须大于0'
        });
      }
      if (!order_subtype || order_subtype !== 'market') {
        if (!price || price <= 0) {
          return res.status(400).json({
            success: false,
            message: '委托价格必须大于0'
          });
        }
      }

      const result = await tradingService.executeSell({
        trading_day_id,
        symbol,
        name,
        price,
        quantity,
        trade_plan_id,
        remark,
        order_subtype: order_subtype || 'limit'
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

  async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await tradingService.cancelOrder(id, reason);

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

  async executePartialFill(req, res) {
    try {
      const { id } = req.params;
      const { fill_quantity, fill_price } = req.body;

      if (!fill_quantity || fill_quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: '成交数量必须大于0'
        });
      }
      if (!fill_price || fill_price <= 0) {
        return res.status(400).json({
          success: false,
          message: '成交价格必须大于0'
        });
      }

      const result = await tradingService.executePartialFill(id, fill_quantity, fill_price);

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

  async getOrders(req, res) {
    try {
      const { trading_day_id, status, symbol, order_type, page = 1, pageSize = 50 } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const result = await orderService.getOrdersByTradingDay(trading_day_id, {
        status,
        symbol,
        order_type,
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

  async getOrderById(req, res) {
    try {
      const { id } = req.params;
      const order = await orderService.getOrderById(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getTradeHistory(req, res) {
    try {
      const { trading_day_id, symbol, trade_type, page = 1, pageSize = 50 } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const result = await tradingService.getTradeHistoryByTradingDay(trading_day_id, {
        symbol,
        trade_type,
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

  async getTradeStatistics(req, res) {
    try {
      const { trading_day_id } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const result = await tradingService.getTradeStatistics(trading_day_id);

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
}

module.exports = new TradingController();
