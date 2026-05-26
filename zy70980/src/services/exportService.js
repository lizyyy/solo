const { Parser } = require('json2csv');
const recordService = require('./recordService');
const historyService = require('./historyService');

class ExportService {
  async exportRecordsToCSV(params = {}) {
    const records = await recordService.listRecords(params);
    const total = await recordService.countRecords(params);
    
    if (records.length !== total) {
      console.warn(`警告: 查询数量(${records.length})与总数(${total})不一致`);
    }
    
    const fields = [
      'record_no', 'pole_no', 'light_no', 'record_type', 'status',
      'alarm_type', 'alarm_level', 'location', 'description',
      'maintenance_team', 'handler', 'report_time',
      'recheck_result', 'recheck_time', 'recheck_by',
      'created_at', 'updated_at'
    ];
    
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(records);
    
    return {
      csv,
      total,
      exported_count: records.length,
      match_count: total === records.length
    };
  }

  async exportRecordDetailToCSV(record_id) {
    const trace = await historyService.getRecordTrace(record_id);
    if (!trace) {
      throw new Error('记录不存在');
    }
    
    const { record, processing_history, related_records, false_alarm_filter } = trace;
    
    const recordFields = [
      'record_no', 'pole_no', 'light_no', 'record_type', 'status',
      'alarm_type', 'alarm_level', 'location', 'description',
      'maintenance_team', 'handler', 'report_time',
      'recheck_result', 'recheck_time', 'recheck_by',
      'created_at', 'updated_at'
    ];
    
    const recordParser = new Parser({ fields: recordFields });
    const recordCSV = recordParser.parse([record]);
    
    const historyFields = [
      'action_type', 'action_reason', 'action_by', 'action_time',
      'previous_status', 'new_status', 'remark'
    ];
    const historyParser = new Parser({ fields: historyFields });
    const historyCSV = processing_history.length > 0 
      ? historyParser.parse(processing_history) 
      : historyParser.parse([]);
    
    let result = '=== 记录基本信息 ===\n';
    result += recordCSV + '\n\n';
    result += '=== 处理历史 ===\n';
    result += historyCSV + '\n\n';
    
    if (related_records && related_records.length > 0) {
      const relatedParser = new Parser({ fields: ['record_no', 'pole_no', 'light_no', 'relation_type', 'status'] });
      const relatedCSV = relatedParser.parse(related_records);
      result += '=== 关联记录(同杆多灯) ===\n';
      result += relatedCSV + '\n\n';
    }
    
    if (false_alarm_filter) {
      const faFields = ['filter_reason', 'filter_by', 'filter_time', 'confidence_score'];
      const faParser = new Parser({ fields: faFields });
      const faCSV = faParser.parse([false_alarm_filter]);
      result += '=== 误报过滤信息 ===\n';
      result += faCSV + '\n\n';
    }
    
    return {
      csv: result,
      record,
      history_count: processing_history.length,
      related_count: related_records ? related_records.length : 0,
      has_false_alarm: !!false_alarm_filter
    };
  }

  async exportRecheckTraceToCSV(params = {}) {
    const recheckParams = { ...params, recheck_result: params.recheck_result || 'pass' };
    const records = await recordService.listRecords(recheckParams);
    
    const traceData = [];
    for (const record of records) {
      const history = await historyService.getHistoryByRecordId(record.id);
      const importHistory = history.find(h => h.action_type === 'import');
      const recheckHistory = history.find(h => h.action_type === 'recheck');
      
      traceData.push({
        record_no: record.record_no,
        pole_no: record.pole_no,
        source_type: importHistory ? importHistory.action_reason : '未知来源',
        source_batch: importHistory ? importHistory.remark : '',
        recheck_result: record.recheck_result,
        recheck_by: record.recheck_by,
        recheck_time: record.recheck_time,
        recheck_reason: recheckHistory ? recheckHistory.action_reason : '',
        original_status: importHistory ? importHistory.new_status : ''
      });
    }
    
    const fields = [
      'record_no', 'pole_no', 'source_type', 'source_batch',
      'recheck_result', 'recheck_by', 'recheck_time',
      'recheck_reason', 'original_status'
    ];
    
    const parser = new Parser({ fields });
    const csv = parser.parse(traceData);
    
    return {
      csv,
      total: traceData.length,
      recheck_result: recheckParams.recheck_result
    };
  }
}

module.exports = new ExportService();
