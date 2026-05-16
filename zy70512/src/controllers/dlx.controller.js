const Joi = require('joi');
const dlxService = require('../services/dlx.service');
const createCsvWriter = require('csv-writer').createObjectCsvStringifier;

const dlxMessageSchema = Joi.object({
  eventId: Joi.string().required(),
  errorTypeId: Joi.number().integer().required(),
  originalInput: Joi.object().required(),
  processingEvidence: Joi.object().optional()
});

const batchSchema = Joi.object({
  batchName: Joi.string().required(),
  errorTypeId: Joi.number().integer().required(),
  strategyId: Joi.number().integer().required(),
  createdBy: Joi.string().optional()
});

const manualCorrectSchema = Joi.object({
  correctedInput: Joi.object().required(),
  operator: Joi.string().optional()
});

class DlxController {
  async createDlxMessage(req, res) {
    try {
      const { error, value } = dlxMessageSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      
      const message = await dlxService.createDlxMessage(
        value.eventId, value.errorTypeId, value.originalInput, value.processingEvidence
      );
      
      res.status(201).json(message);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getDlxMessage(req, res) {
    try {
      const message = await dlxService.getDlxMessage(req.params.id);
      if (!message) {
        return res.status(404).json({ error: '消息不存在' });
      }
      res.json(message);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async listDlxMessages(req, res) {
    try {
      const filters = {
        errorTypeId: req.query.errorTypeId ? parseInt(req.query.errorTypeId) : undefined,
        status: req.query.status,
        batchId: req.query.batchId
      };
      
      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: Math.min(parseInt(req.query.limit) || 20, 100)
      };
      
      const result = await dlxService.listDlxMessages(filters, pagination);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getGroupedByErrorType(req, res) {
    try {
      const groups = await dlxService.groupByErrorType();
      res.json(groups);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async createBatch(req, res) {
    try {
      const { error, value } = batchSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      
      const batch = await dlxService.createBatch(
        value.batchName, value.errorTypeId, value.strategyId, value.createdBy
      );
      
      res.status(201).json(batch);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getBatch(req, res) {
    try {
      const batch = await dlxService.getBatch(req.params.id);
      if (!batch) {
        return res.status(404).json({ error: '批次不存在' });
      }
      res.json(batch);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async listBatches(req, res) {
    try {
      const filters = {
        errorTypeId: req.query.errorTypeId ? parseInt(req.query.errorTypeId) : undefined,
        status: req.query.status
      };
      
      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: Math.min(parseInt(req.query.limit) || 20, 100)
      };
      
      const result = await dlxService.listBatches(filters, pagination);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async startBatch(req, res) {
    try {
      const batch = await dlxService.startBatch(req.params.id);
      res.json(batch);
    } catch (err) {
      if (err.message === '批次不存在') {
        return res.status(404).json({ error: err.message });
      }
      if (err.message === '批次状态不正确') {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  }

  async processMessage(req, res) {
    try {
      const message = await dlxService.processMessage(req.params.id);
      res.json(message);
    } catch (err) {
      if (err.message === '消息不存在') {
        return res.status(404).json({ error: err.message });
      }
      if (err.message.includes('限流')) {
        return res.status(429).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  }

  async manualCorrect(req, res) {
    try {
      const { error, value } = manualCorrectSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      
      const message = await dlxService.manualCorrect(
        req.params.id, value.correctedInput, value.operator
      );
      
      res.json(message);
    } catch (err) {
      if (err.message === '消息不存在') {
        return res.status(404).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  }

  async retryAfterManualCorrect(req, res) {
    try {
      const message = await dlxService.retryAfterManualCorrect(req.params.id);
      res.json(message);
    } catch (err) {
      if (err.message === '消息不存在') {
        return res.status(404).json({ error: err.message });
      }
      res.status(400).json({ error: err.message });
    }
  }

  async generateReport(req, res) {
    try {
      const report = await dlxService.generateReport(req.params.id, req.query.type || 'summary');
      res.json(report);
    } catch (err) {
      if (err.message === '批次不存在') {
        return res.status(404).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  }

  async exportMessages(req, res) {
    try {
      const messages = await dlxService.exportMessages(req.params.id);
      
      if (req.query.format === 'csv') {
        const csvWriter = createCsvWriter({
          header: [
            { id: 'id', title: 'ID' },
            { id: 'status', title: '状态' },
            { id: 'retry_count', title: '重试次数' },
            { id: 'last_error', title: '最后错误' },
            { id: 'event_type', title: '事件类型' },
            { id: 'callback_url', title: '回调地址' },
            { id: 'error_code', title: '错误码' },
            { id: 'error_name', title: '错误名称' },
            { id: 'created_at', title: '创建时间' }
          ]
        });
        
        const csv = csvWriter.stringifyRecords(messages);
        const header = csvWriter.getHeaderString();
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="dlx-messages-${req.params.id}.csv"`);
        res.send('\uFEFF' + header + '\n' + csv);
      } else {
        res.json(messages);
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async createEvent(req, res) {
    try {
      const event = await dlxService.createEvent(req.body);
      res.status(201).json(event);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async listErrorTypes(req, res) {
    try {
      const types = await dlxService.listErrorTypes();
      res.json(types);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async listStrategies(req, res) {
    try {
      const strategies = await dlxService.listStrategies();
      res.json(strategies);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new DlxController();
