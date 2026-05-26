const recordService = require('../services/recordService');
const batchService = require('../services/batchService');
const historyService = require('../services/historyService');
const specialService = require('../services/specialService');
const importService = require('../services/importService');
const exportService = require('../services/exportService');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

class RecordController {
  async createBatch(req, res) {
    try {
      const batch = await batchService.createBatch(req.body);
      res.json({ success: true, data: batch });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async listBatches(req, res) {
    try {
      const batches = await batchService.listBatches(req.query);
      res.json({ success: true, data: batches });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getBatch(req, res) {
    try {
      const batch = await batchService.getBatchByNo(req.params.batch_no);
      if (!batch) {
        return res.status(404).json({ success: false, error: '批次不存在' });
      }
      res.json({ success: true, data: batch });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async importAlarmCSV(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请上传CSV文件' });
      }
      const { created_by, source_name } = req.body;
      if (!created_by) {
        return res.status(400).json({ success: false, error: '请提供创建人(created_by)' });
      }
      const result = await importService.importAlarmCSV(req.file.path, created_by, source_name);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async importInspectionJSON(req, res) {
    try {
      const { data, created_by, source_name } = req.body;
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ success: false, error: '请提供数据数组(data)' });
      }
      if (!created_by) {
        return res.status(400).json({ success: false, error: '请提供创建人(created_by)' });
      }
      const result = await importService.importInspectionJSON(data, created_by, source_name);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async importWorkOrder(req, res) {
    try {
      const { order_data, created_by } = req.body;
      if (!order_data) {
        return res.status(400).json({ success: false, error: '请提供维修单数据(order_data)' });
      }
      if (!created_by) {
        return res.status(400).json({ success: false, error: '请提供创建人(created_by)' });
      }
      const result = await importService.importWorkOrder(order_data, created_by);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async listRecords(req, res) {
    try {
      const records = await recordService.listRecords(req.query);
      const total = await recordService.countRecords(req.query);
      res.json({ 
        success: true, 
        data: records,
        total,
        count: records.length,
        match_count: total === records.length
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getRecord(req, res) {
    try {
      const record = await recordService.getRecordByNo(req.params.record_no);
      if (!record) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }
      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async processRecord(req, res) {
    try {
      const { record_no, status, action_reason, action_by, remark } = req.body;
      if (!record_no || !status || !action_by) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }
      
      const record = await recordService.getRecordByNo(record_no);
      if (!record) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }
      
      const previousStatus = record.status;
      await recordService.updateRecordStatus(record.id, status);
      
      await historyService.addHistory({
        record_id: record.id,
        action_type: 'process',
        action_reason: action_reason || '标记处理',
        action_by,
        previous_status: previousStatus,
        new_status: status,
        remark
      });
      
      const updatedRecord = await recordService.getRecordById(record.id);
      res.json({ success: true, data: updatedRecord });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async returnRecord(req, res) {
    try {
      const { record_no, return_reason, action_by, remark } = req.body;
      if (!record_no || !return_reason || !action_by) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }
      
      const record = await recordService.getRecordByNo(record_no);
      if (!record) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }
      
      const previousStatus = record.status;
      await recordService.updateRecordStatus(record.id, 'returned');
      
      await historyService.addHistory({
        record_id: record.id,
        action_type: 'return',
        action_reason: return_reason,
        action_by,
        previous_status: previousStatus,
        new_status: 'returned',
        remark: remark || '退回修改'
      });
      
      const updatedRecord = await recordService.getRecordById(record.id);
      res.json({ success: true, data: updatedRecord });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getRecordTrace(req, res) {
    try {
      const record = await recordService.getRecordByNo(req.params.record_no);
      if (!record) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }
      
      const trace = await historyService.getRecordTrace(record.id);
      res.json({ success: true, data: trace });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getRecordHistory(req, res) {
    try {
      const record = await recordService.getRecordByNo(req.params.record_no);
      if (!record) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }
      
      const history = await historyService.getHistoryByRecordId(record.id);
      res.json({ success: true, data: history });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleMultiLight(req, res) {
    try {
      const { main_record_no, related_record_nos, action_by, reason } = req.body;
      if (!main_record_no || !related_record_nos || !Array.isArray(related_record_nos) || !action_by) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }
      
      const mainRecord = await recordService.getRecordByNo(main_record_no);
      if (!mainRecord) {
        return res.status(404).json({ success: false, error: '主记录不存在' });
      }
      
      const relatedIds = [];
      for (const no of related_record_nos) {
        const rec = await recordService.getRecordByNo(no);
        if (rec) {
          relatedIds.push(rec.id);
        }
      }
      
      const result = await specialService.handleMultiLight(mainRecord.id, relatedIds, action_by, reason);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async filterFalseAlarm(req, res) {
    try {
      const { record_no, filter_reason, filter_by, confidence_score } = req.body;
      if (!record_no || !filter_reason || !filter_by) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }
      
      const record = await recordService.getRecordByNo(record_no);
      if (!record) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }
      
      const result = await specialService.filterFalseAlarm(record.id, filter_reason, filter_by, confidence_score);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async recheckRecord(req, res) {
    try {
      const { record_no, recheck_result, recheck_by, recheck_reason } = req.body;
      if (!record_no || !recheck_result || !recheck_by) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }
      
      const record = await recordService.getRecordByNo(record_no);
      if (!record) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }
      
      const result = await specialService.recheckRecord(record.id, recheck_result, recheck_by, recheck_reason);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async exportRecords(req, res) {
    try {
      const result = await exportService.exportRecordsToCSV(req.query);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="records_${Date.now()}.csv"`);
      res.send('\uFEFF' + result.csv);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async exportRecordDetail(req, res) {
    try {
      const record = await recordService.getRecordByNo(req.params.record_no);
      if (!record) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }
      
      const result = await exportService.exportRecordDetailToCSV(record.id);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="detail_${record.record_no}.csv"`);
      res.send('\uFEFF' + result.csv);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async exportRecheckTrace(req, res) {
    try {
      const result = await exportService.exportRecheckTraceToCSV(req.query);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="recheck_trace_${Date.now()}.csv"`);
      res.send('\uFEFF' + result.csv);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new RecordController();
