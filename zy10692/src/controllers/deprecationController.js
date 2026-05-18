const fieldDeprecation = require('../models/FieldDeprecation');
const { Parser } = require('json2csv');

class DeprecationController {
  async batchImport(req, res) {
    try {
      const { records } = req.body;
      
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: 'records必须是非空数组'
        });
      }

      const requiredFields = ['tableName', 'fieldName', 'downstreamTask', 'notifier'];
      for (let i = 0; i < records.length; i++) {
        const missing = requiredFields.filter(f => !records[i][f]);
        if (missing.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'MISSING_FIELDS',
            message: `第${i + 1}条记录缺少必填字段: ${missing.join(', ')}`,
            index: i
          });
        }
      }

      const results = fieldDeprecation.batchImport(records);
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        data: {
          total: records.length,
          success: successCount,
          failed: failCount,
          results
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  async confirm(req, res) {
    try {
      const { id } = req.params;
      const { confirmedBy, notes } = req.body;

      if (!confirmedBy) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_CONFIRMED_BY',
          message: 'confirmedBy为必填字段'
        });
      }

      const record = fieldDeprecation.confirm(id, confirmedBy, notes);
      
      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      const statusMap = {
        'RECORD_NOT_FOUND': 404,
        'RECORD_REVOKED': 400
      };
      res.status(statusMap[error.message] || 500).json({
        success: false,
        error: error.message,
        message: error.message === 'RECORD_NOT_FOUND' ? '记录不存在' : 
                 error.message === 'RECORD_REVOKED' ? '记录已撤回，无法确认' : error.message
      });
    }
  }

  async revoke(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const record = fieldDeprecation.revoke(id, reason);
      
      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: 'RECORD_NOT_FOUND',
        message: '记录不存在'
      });
    }
  }

  async validatePublish(req, res) {
    try {
      const { tableName, fieldName } = req.query;

      if (!tableName || !fieldName) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_PARAMS',
          message: 'tableName和fieldName为必填参数'
        });
      }

      const result = fieldDeprecation.validatePublish(tableName, fieldName);

      if (!result.canPublish) {
        return res.status(403).json({
          success: false,
          error: 'UNCONFIRMED_DOWNSTREAMS',
          message: `存在${result.unconfirmedRecords.length}个下游任务未确认，禁止发布`,
          data: {
            canPublish: false,
            unconfirmedCount: result.unconfirmedRecords.length,
            unconfirmedRecords: result.unconfirmedRecords
          }
        });
      }

      res.json({
        success: true,
        data: {
          canPublish: true,
          unconfirmedCount: 0,
          unconfirmedRecords: []
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  async getAll(req, res) {
    try {
      const { tableName, fieldName, status, downstreamTask } = req.query;
      
      const records = fieldDeprecation.getAll({
        tableName,
        fieldName,
        status,
        downstreamTask
      });

      res.json({
        success: true,
        data: records
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const record = fieldDeprecation.getById(id);

      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'RECORD_NOT_FOUND',
          message: '记录不存在'
        });
      }

      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  async exportCSV(req, res) {
    try {
      const { tableName, fieldName, status, downstreamTask } = req.query;
      
      const data = fieldDeprecation.exportToCSV({
        tableName,
        fieldName,
        status,
        downstreamTask
      });

      if (data.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NO_DATA',
          message: '没有可导出的数据'
        });
      }

      const parser = new Parser();
      const csv = parser.parse(data);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="field-deprecation-${Date.now()}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  async getStatistics(req, res) {
    try {
      const stats = fieldDeprecation.getStatistics();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
}

module.exports = new DeprecationController();