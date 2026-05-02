const { Parser } = require('json2csv');
const moment = require('moment');

class CsvExporter {
  static async exportAuditLogs(auditLogs, options = {}) {
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '操作类型', value: 'action' },
      { label: '实体类型', value: 'entity_type' },
      { label: '实体ID', value: 'entity_id' },
      { label: '实体名称', value: 'entity_name' },
      { label: '描述', value: 'description' },
      { label: '用户ID', value: 'user_id' },
      { label: '用户角色', value: 'user_role' },
      { 
        label: '操作时间', 
        value: (row) => row.created_at ? moment(row.created_at).format('YYYY-MM-DD HH:mm:ss') : ''
      }
    ];
    
    const json2csvParser = new Parser({ fields, withBOM: true });
    const csv = json2csvParser.parse(auditLogs);
    
    const filename = `audit-log-${moment().format('YYYYMMDDHHmmss')}.csv`;
    
    return {
      content: csv,
      filename: filename,
      mimeType: 'text/csv; charset=utf-8'
    };
  }

  static async exportRequests(requests, options = {}) {
    const fields = [
      { label: '申请单号', value: 'request_number' },
      { label: '申请人ID', value: 'requester_id' },
      { label: '申请人', value: 'requester_name' },
      { label: '试剂名称', value: (row) => row.chemical?.name || '' },
      { label: '批次号', value: (row) => row.batch?.batch_number || '' },
      { label: '领用数量', value: (row) => `${row.quantity} ${row.unit}` },
      { label: '用途', value: 'purpose' },
      { label: '状态', value: 'status_text' },
      { 
        label: '申请时间', 
        value: (row) => row.requested_at ? moment(row.requested_at).format('YYYY-MM-DD HH:mm:ss') : ''
      },
      { label: '审批人', value: 'approver_name' },
      { 
        label: '审批时间', 
        value: (row) => row.approved_at ? moment(row.approved_at).format('YYYY-MM-DD HH:mm:ss') : ''
      },
      { label: '驳回原因', value: 'rejection_reason' },
      { label: '执行人', value: 'executor_name' },
      { 
        label: '执行时间', 
        value: (row) => row.executed_at ? moment(row.executed_at).format('YYYY-MM-DD HH:mm:ss') : ''
      },
      { label: '归还数量', value: (row) => row.return_quantity ? `${row.return_quantity} ${row.unit}` : '' },
      { 
        label: '归还时间', 
        value: (row) => row.returned_at ? moment(row.returned_at).format('YYYY-MM-DD HH:mm:ss') : ''
      },
      { label: '报废原因', value: 'disposal_reason' },
      { 
        label: '报废时间', 
        value: (row) => row.disposed_at ? moment(row.disposed_at).format('YYYY-MM-DD HH:mm:ss') : ''
      }
    ];
    
    const json2csvParser = new Parser({ fields, withBOM: true });
    const csv = json2csvParser.parse(requests);
    
    const filename = `requests-${moment().format('YYYYMMDDHHmmss')}.csv`;
    
    return {
      content: csv,
      filename: filename,
      mimeType: 'text/csv; charset=utf-8'
    };
  }

  static async exportBatches(batches, options = {}) {
    const fields = [
      { label: '批次号', value: 'batch_number' },
      { label: '试剂名称', value: (row) => row.chemical?.name || '' },
      { label: '危险等级', value: (row) => row.chemical?.danger_level || '' },
      { label: '生产时间', value: 'production_date' },
      { label: '有效期', value: 'expiry_date' },
      { label: '初始数量', value: (row) => `${row.initial_quantity} ${row.unit}` },
      { label: '当前库存', value: (row) => `${row.current_quantity} ${row.unit}` },
      { label: '供应商', value: 'supplier' },
      { label: '制造商', value: 'manufacturer' },
      { label: '存储位置', value: 'storage_location' },
      { label: '状态', value: (row) => row.is_expired ? '已过期' : row.status },
      { label: '剩余有效期(天)', value: 'days_until_expiry' }
    ];
    
    const json2csvParser = new Parser({ fields, withBOM: true });
    const csv = json2csvParser.parse(batches);
    
    const filename = `batches-${moment().format('YYYYMMDDHHmmss')}.csv`;
    
    return {
      content: csv,
      filename: filename,
      mimeType: 'text/csv; charset=utf-8'
    };
  }

  static async exportChemicals(chemicals, options = {}) {
    const fields = [
      { label: '试剂名称', value: 'name' },
      { label: '英文名称', value: 'english_name' },
      { label: 'CAS号', value: 'cas_number' },
      { label: '分子式', value: 'formula' },
      { label: '危险等级', value: 'danger_level' },
      { label: '描述', value: 'description' },
      { label: '存储要求', value: 'storage_requirements' },
      { label: '计量单位', value: 'unit' },
      { 
        label: '创建时间', 
        value: (row) => row.created_at ? moment(row.created_at).format('YYYY-MM-DD HH:mm:ss') : ''
      }
    ];
    
    const json2csvParser = new Parser({ fields, withBOM: true });
    const csv = json2csvParser.parse(chemicals);
    
    const filename = `chemicals-${moment().format('YYYYMMDDHHmmss')}.csv`;
    
    return {
      content: csv,
      filename: filename,
      mimeType: 'text/csv; charset=utf-8'
    };
  }
}

module.exports = CsvExporter;
