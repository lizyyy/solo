const db = require('../database/init');
const { Parser } = require('json2csv');
const moment = require('moment');

class ExportService {
  static exportDamageSeizures(filters = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (filters.handled_by) {
      whereClause += ' AND ds.handled_by = ?';
      params.push(filters.handled_by);
    }

    if (filters.startDate) {
      whereClause += ' AND ds.created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClause += ' AND ds.created_at <= ?';
      params.push(filters.endDate + ' 23:59:59');
    }

    const seizures = db.prepare(`
      SELECT 
        ds.seizure_no,
        ds.return_no,
        ds.bucket_code,
        ds.damage_type,
        ds.damage_level,
        ds.seizure_reason,
        ds.is_compensable,
        ds.compensation_amount,
        ds.status,
        ds.handled_by,
        ds.previous_handler,
        ds.change_reason,
        ds.affected_records,
        ds.created_at,
        ca.customer_name,
        ca.customer_id,
        br.return_date
      FROM damage_seizures ds
      LEFT JOIN bucket_returns br ON ds.return_no = br.return_no
      LEFT JOIN customer_addresses ca ON br.customer_address_id = ca.id
      ${whereClause}
      ORDER BY ds.created_at DESC
    `).all(...params);

    const damageTypeMap = {
      'crack': '破裂',
      'leak': '漏水',
      'deformation': '变形',
      'missing_parts': '配件缺失',
      'contamination': '污染',
      'other': '其他'
    };

    const damageLevelMap = {
      'minor': '轻微',
      'moderate': '中等',
      'severe': '严重'
    };

    const statusMap = {
      'pending': '待处理',
      'confirmed': '已确认',
      'appealed': '已申诉',
      'resolved': '已解决'
    };

    const data = seizures.map(s => ({
      '扣押编号': s.seizure_no,
      '退桶单号': s.return_no,
      '桶编号': s.bucket_code,
      '客户名称': s.customer_name,
      '客户ID': s.customer_id,
      '破损类型': damageTypeMap[s.damage_type] || s.damage_type,
      '破损程度': damageLevelMap[s.damage_level] || s.damage_level,
      '扣押原因': s.seizure_reason,
      '需赔偿': s.is_compensable ? '是' : '否',
      '赔偿金额': s.compensation_amount,
      '状态': statusMap[s.status] || s.status,
      '当前处理人': s.handled_by,
      '修改人': s.previous_handler || '',
      '修改原因': s.change_reason || '',
      '影响记录': s.affected_records || '',
      '退桶日期': s.return_date,
      '创建时间': moment(s.created_at).format('YYYY-MM-DD HH:mm:ss')
    }));

    const fields = [
      '扣押编号', '退桶单号', '桶编号', '客户名称', '客户ID',
      '破损类型', '破损程度', '扣押原因', '需赔偿', '赔偿金额',
      '状态', '当前处理人', '修改人', '修改原因', '影响记录',
      '退桶日期', '创建时间'
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(data);
  }

  static exportBalances(filters = {}) {
    const addresses = db.prepare('SELECT id FROM customer_addresses WHERE is_active = 1').all();
    const BalanceService = require('./BalanceService');
    
    const balances = addresses.map(addr => BalanceService.calculateBalance(addr.id));

    const data = balances.map(b => ({
      '客户ID': b.customerId,
      '客户名称': b.customerName,
      '总借桶数': b.totalBorrowed,
      '总还桶数': b.totalReturned,
      '破损数': b.totalDamaged,
      '扣押数': b.totalSeized,
      '欠桶数': b.outstandingBalance,
      '单桶价格': b.bucketPrice,
      '欠桶余额': b.balanceAmount
    }));

    const fields = [
      '客户ID', '客户名称', '总借桶数', '总还桶数', '破损数',
      '扣押数', '欠桶数', '单桶价格', '欠桶余额'
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(data);
  }

  static exportOperationLogs(filters = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (filters.operator) {
      whereClause += ' AND operator = ?';
      params.push(filters.operator);
    }

    if (filters.startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(filters.endDate + ' 23:59:59');
    }

    const logs = db.prepare(`
      SELECT * FROM operation_logs
      ${whereClause}
      ORDER BY created_at DESC
    `).all(...params);

    const moduleMap = {
      'customer_addresses': '客户地址',
      'delivery_signoffs': '配送签收',
      'bucket_returns': '退桶验收',
      'damage_seizures': '破损扣押',
      'bucket_balances': '欠桶余额'
    };

    const operationMap = {
      'CREATE': '创建',
      'UPDATE': '更新',
      'REVIEW': '审核',
      'DELETE': '删除'
    };

    const data = logs.map(l => ({
      '操作类型': operationMap[l.operation_type] || l.operation_type,
      '模块': moduleMap[l.module] || l.module,
      '记录编号': l.record_no || l.record_id,
      '修改前内容': l.before_values || '',
      '修改后内容': l.after_values || '',
      '操作人ID': l.operator,
      '操作人姓名': l.operator_name,
      '备注': l.operation_remark || '',
      '操作时间': moment(l.created_at).format('YYYY-MM-DD HH:mm:ss')
    }));

    const fields = [
      '操作类型', '模块', '记录编号', '修改前内容', '修改后内容',
      '操作人ID', '操作人姓名', '备注', '操作时间'
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(data);
  }
}

module.exports = ExportService;
