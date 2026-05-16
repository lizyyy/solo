const StrategyService = require('../services/strategyService');
const {
  createStrategySchema,
  updateStatusSchema,
  failurePathSchema,
  impactRecordSchema,
  matchStrategySchema,
  exportSchema
} = require('../utils/validation');

class StrategyController {
  static async createStrategy(req, res) {
    try {
      const { error, value } = createStrategySchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: '参数验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      const strategy = StrategyService.createStrategy(value);
      res.status(201).json({
        success: true,
        message: '策略创建成功',
        data: strategy.toJSON()
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: '创建策略失败',
        error: err.message
      });
    }
  }

  static async getStrategy(req, res) {
    try {
      const { id } = req.params;
      const strategy = StrategyService.getStrategyById(id);
      
      if (!strategy) {
        return res.status(404).json({
          success: false,
          message: '策略不存在'
        });
      }

      res.json({
        success: true,
        data: strategy.toJSON()
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: '查询策略失败',
        error: err.message
      });
    }
  }

  static async listStrategies(req, res) {
    try {
      const filters = {
        status: req.query.status,
        degradationLevel: req.query.degradationLevel,
        strategyName: req.query.strategyName
      };

      const strategies = StrategyService.listStrategies(filters);
      res.json({
        success: true,
        data: strategies.map(s => s.toJSON()),
        total: strategies.length
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: '查询策略列表失败',
        error: err.message
      });
    }
  }

  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { error, value } = updateStatusSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: '参数验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      const strategy = StrategyService.updateStatus(
        id,
        value.status,
        value.operator,
        value.reason
      );

      res.json({
        success: true,
        message: '状态更新成功',
        data: strategy.toJSON()
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: '状态更新失败',
        error: err.message
      });
    }
  }

  static async publishStrategy(req, res) {
    try {
      const { id } = req.params;
      const { operator } = req.body;

      if (!operator) {
        return res.status(400).json({
          success: false,
          message: '操作人不能为空'
        });
      }

      const strategy = StrategyService.publishStrategy(id, operator);
      res.json({
        success: true,
        message: '策略发布成功',
        data: strategy.toJSON()
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: '策略发布失败',
        error: err.message
      });
    }
  }

  static async activateStrategy(req, res) {
    try {
      const { id } = req.params;
      const { operator, reason } = req.body;

      if (!operator) {
        return res.status(400).json({
          success: false,
          message: '操作人不能为空'
        });
      }

      const strategy = StrategyService.activateStrategy(id, operator, reason);
      res.json({
        success: true,
        message: '策略激活成功',
        data: strategy.toJSON()
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: '策略激活失败',
        error: err.message
      });
    }
  }

  static async compensateStrategy(req, res) {
    try {
      const { id } = req.params;
      const { operator, reason } = req.body;

      if (!operator) {
        return res.status(400).json({
          success: false,
          message: '操作人不能为空'
        });
      }

      const strategy = StrategyService.compensateStrategy(id, operator, reason);
      res.json({
        success: true,
        message: '策略补偿完成',
        data: strategy.toJSON()
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: '策略补偿失败',
        error: err.message
      });
    }
  }

  static async revokeStrategy(req, res) {
    try {
      const { id } = req.params;
      const { operator, reason } = req.body;

      if (!operator) {
        return res.status(400).json({
          success: false,
          message: '操作人不能为空'
        });
      }

      const strategy = StrategyService.revokeStrategy(id, operator, reason);
      res.json({
        success: true,
        message: '策略撤销成功',
        data: strategy.toJSON()
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: '策略撤销失败',
        error: err.message
      });
    }
  }

  static async manualCorrect(req, res) {
    try {
      const { id } = req.params;
      const { correctionData, operator } = req.body;

      if (!operator) {
        return res.status(400).json({
          success: false,
          message: '操作人不能为空'
        });
      }

      const strategy = StrategyService.manualCorrect(id, correctionData, operator);
      res.json({
        success: true,
        message: '人工修正成功',
        data: strategy.toJSON()
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: '人工修正失败',
        error: err.message
      });
    }
  }

  static async recordFailure(req, res) {
    try {
      const { id } = req.params;
      const { error, value } = failurePathSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: '参数验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      const strategy = StrategyService.recordFailure(
        id,
        value.originalInput,
        value.processingBasis,
        value.finalConclusion
      );

      res.json({
        success: true,
        message: '失败记录已保存',
        data: strategy.toJSON()
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: '保存失败记录失败',
        error: err.message
      });
    }
  }

  static async addImpactRecord(req, res) {
    try {
      const { id } = req.params;
      const { error, value } = impactRecordSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: '参数验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      const strategy = StrategyService.addImpactRecord(id, value);
      res.json({
        success: true,
        message: '影响记录已添加',
        data: strategy.toJSON()
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: '添加影响记录失败',
        error: err.message
      });
    }
  }

  static async matchStrategies(req, res) {
    try {
      const { error, value } = matchStrategySchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: '参数验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      const strategies = StrategyService.matchStrategies(value.apiGroup, value.tenantId);
      res.json({
        success: true,
        data: strategies.map(s => ({
          id: s.id,
          strategyName: s.strategyName,
          degradationLevel: s.degradationLevel
        })),
        matched: strategies.length
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: '策略匹配失败',
        error: err.message
      });
    }
  }

  static async exportStrategies(req, res) {
    try {
      const { error, value } = exportSchema.validate(req.query);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: '参数验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      const result = StrategyService.exportStrategies(value);
      
      if (value.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="strategies.csv"');
        res.send(result.data);
      } else {
        res.json({
          success: true,
          summary: result.summary,
          data: result.data
        });
      }
    } catch (err) {
      res.status(500).json({
        success: false,
        message: '导出失败',
        error: err.message
      });
    }
  }

  static async exportImpactSummary(req, res) {
    try {
      const { id } = req.params;
      const format = req.query.format || 'json';

      const result = StrategyService.exportImpactSummary(id, format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="impact-${id}.csv"`);
        res.send(result.data);
      } else {
        res.json({
          success: true,
          strategyName: result.strategyName,
          data: result.data
        });
      }
    } catch (err) {
      res.status(500).json({
        success: false,
        message: '导出影响摘要失败',
        error: err.message
      });
    }
  }

  static async getStatistics(req, res) {
    try {
      const stats = StrategyService.getStatistics();
      res.json({
        success: true,
        data: stats
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: err.message
      });
    }
  }
}

module.exports = StrategyController;
