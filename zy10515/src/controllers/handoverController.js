const ConfigHandover = require('../models/ConfigHandover');
const { Parser } = require('json2csv');

class HandoverController {
  static async createCustomer(req, res) {
    try {
      const { customerId, customerName } = req.body;
      
      if (!customerId || !customerName) {
        return res.status(400).json({ error: '客户ID和名称不能为空' });
      }

      const result = await ConfigHandover.createCustomer(customerId, customerName);
      res.json(result);
    } catch (error) {
      await ConfigHandover.recordException({
        type: 'create_customer_error',
        originalInput: JSON.stringify(req.body),
        errorMessage: error.message
      });
      res.status(500).json({ error: error.message });
    }
  }

  static async createConfigItem(req, res) {
    try {
      const data = req.body;
      
      if (!data.customerId || !data.configKey || !data.configValue) {
        return res.status(400).json({ error: '客户ID、配置键和配置值不能为空' });
      }

      if (!data.operatorId || !data.operatorName) {
        return res.status(400).json({ error: '操作人ID和名称不能为空' });
      }

      const result = await ConfigHandover.createConfigItem(data);

      if (data.sourceMaterial && result.isNew) {
        await ConfigHandover.addSourceMaterial(result.id, data.sourceMaterial);
      }

      res.json(result);
    } catch (error) {
      await ConfigHandover.recordException({
        type: 'create_config_error',
        originalInput: JSON.stringify(req.body),
        errorMessage: error.message
      });
      res.status(500).json({ error: error.message });
    }
  }

  static async getConfigItem(req, res) {
    try {
      const { id } = req.params;
      const config = await ConfigHandover.getConfigItem(id);
      
      if (!config) {
        return res.status(404).json({ error: '配置项不存在' });
      }

      const sources = await ConfigHandover.getSourceMaterials(id);
      const confirmations = await ConfigHandover.getConfirmations(id);
      const changes = await ConfigHandover.getChangeRecords(id);

      res.json({
        config,
        sources: await sources,
        confirmations: await confirmations,
        changes: await changes
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getCustomerConfigs(req, res) {
    try {
      const { customerId } = req.params;
      const configs = await ConfigHandover.getConfigItemsByCustomer(customerId);
      res.json(configs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async advanceStatus(req, res) {
    try {
      const { id } = req.params;
      const { newStatus, operatorId, operatorName, comment } = req.body;

      if (!newStatus || !operatorId || !operatorName) {
        return res.status(400).json({ error: '目标状态和操作人信息不能为空' });
      }

      const result = await ConfigHandover.advanceStatus(id, newStatus, operatorId, operatorName, comment);
      res.json(result);
    } catch (error) {
      await ConfigHandover.recordException({
        configItemId: id,
        type: 'status_advance_error',
        originalInput: JSON.stringify(req.body),
        errorMessage: error.message
      });
      res.status(500).json({ error: error.message });
    }
  }

  static async confirmConfig(req, res) {
    try {
      const { id } = req.params;
      const { confirmerId, confirmerName, comment } = req.body;

      if (!confirmerId || !confirmerName) {
        return res.status(400).json({ error: '确认人信息不能为空' });
      }

      const result = await ConfigHandover.confirmConfig(id, confirmerId, confirmerName, comment);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async manualCorrection(req, res) {
    try {
      const { id } = req.params;
      const { newValue, operatorId, operatorName, reason } = req.body;

      if (!newValue || !operatorId || !operatorName) {
        return res.status(400).json({ error: '新值和操作人信息不能为空' });
      }

      if (!reason) {
        return res.status(400).json({ error: '变更原因不能为空' });
      }

      const result = await ConfigHandover.manualCorrection(id, newValue, operatorId, operatorName, reason);
      res.json(result);
    } catch (error) {
      await ConfigHandover.recordException({
        configItemId: id,
        type: 'manual_correction_error',
        originalInput: JSON.stringify(req.body),
        errorMessage: error.message
      });
      res.status(500).json({ error: error.message });
    }
  }

  static async addSourceMaterial(req, res) {
    try {
      const { id } = req.params;
      const material = req.body;

      if (!material.type || !material.content || !material.uploadedBy) {
        return res.status(400).json({ error: '材料类型、内容和上传人不能为空' });
      }

      const result = await ConfigHandover.addSourceMaterial(id, material);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getExceptions(req, res) {
    try {
      const filters = req.query;
      const exceptions = await ConfigHandover.getExceptions(filters);
      res.json(exceptions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async handleException(req, res) {
    try {
      const { id } = req.params;
      const { handledBy } = req.body;

      if (!handledBy) {
        return res.status(400).json({ error: '处理人不能为空' });
      }

      const result = await ConfigHandover.handleException(id, handledBy);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async generateHandoverSummary(req, res) {
    try {
      const { customerId } = req.params;
      const { generatedBy } = req.body;

      if (!generatedBy) {
        return res.status(400).json({ error: '生成人不能为空' });
      }

      const result = await ConfigHandover.generateHandoverSummary(customerId, generatedBy);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportConfig(req, res) {
    try {
      const { customerId } = req.params;
      const configs = await ConfigHandover.getConfigItemsByCustomer(customerId);
      const customer = await ConfigHandover.getCustomer(customerId);

      if (!customer) {
        return res.status(404).json({ error: '客户不存在' });
      }

      const exportData = [];
      for (const config of configs) {
        const sources = await ConfigHandover.getSourceMaterials(config.id);
        const confirmations = await ConfigHandover.getConfirmations(config.id);
        const changes = await ConfigHandover.compareChanges(config.id);

        exportData.push({
          customerId: customer.customer_id,
          customerName: customer.customer_name,
          configKey: config.config_key,
          configValue: config.config_value,
          configType: config.config_type,
          description: config.description,
          status: config.status,
          sourceCount: sources.length,
          confirmationCount: confirmations.length,
          changeCount: changes.length,
          createdAt: config.created_at
        });
      }

      const format = req.query.format || 'json';

      if (format === 'csv') {
        const parser = new Parser();
        const csv = parser.parse(exportData);
        res.header('Content-Type', 'text/csv');
        res.attachment(`handover_${customerId}_${Date.now()}.csv`);
        res.send(csv);
      } else {
        res.json({
          customer,
          exportTime: new Date().toISOString(),
          data: exportData
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async compareChanges(req, res) {
    try {
      const { id } = req.params;
      const comparisons = await ConfigHandover.compareChanges(id);
      res.json(comparisons);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getHandoverSummaries(req, res) {
    try {
      const { customerId } = req.params;
      const summaries = await ConfigHandover.getHandoverSummaries(customerId);
      res.json(summaries);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = HandoverController;
