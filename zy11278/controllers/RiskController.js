const riskService = require('../services/RiskService');
const db = require('../models');

class RiskController {
  async getAlerts(req, res) {
    try {
      const { trading_day_id, status, severity, alert_type, page = 1, pageSize = 50 } = req.query;

      const result = await riskService.getActiveAlerts(trading_day_id || null, {
        status,
        severity,
        alert_type,
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

  async acknowledgeAlert(req, res) {
    try {
      const { id } = req.params;
      const { acknowledged_by } = req.body;

      const alert = await riskService.acknowledgeAlert(id, acknowledged_by);

      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async resolveAlert(req, res) {
    try {
      const { id } = req.params;
      const { resolution_note } = req.body;

      if (!resolution_note) {
        return res.status(400).json({
          success: false,
          message: '解决说明不能为空'
        });
      }

      const alert = await riskService.resolveAlert(id, resolution_note);

      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async runChecks(req, res) {
    try {
      const { trading_day_id } = req.params;
      const positionService = require('../services/PositionService');

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const alerts = await riskService.runAllChecks(trading_day_id, positionService);

      res.json({
        success: true,
        data: {
          count: alerts.length,
          alerts
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getAlertById(req, res) {
    try {
      const { id } = req.params;

      const alert = await db.RiskAlert.findByPk(id, {
        include: [{
          model: db.TradingDay,
          as: 'tradingDay'
        }]
      });

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: '预警不存在'
        });
      }

      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new RiskController();
