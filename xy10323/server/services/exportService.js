const XLSX = require('xlsx');
const { db } = require('../database');

class ExportService {
  static getExportData(filters = {}) {
    let query = `
      SELECT 
        a.application_no as '申请编号',
        a.room_no as '房间号',
        a.owner_name as '业主姓名',
        a.phone as '联系电话',
        a.deposit_amount as '押金金额',
        a.application_date as '申请日期',
        CASE a.status 
          WHEN 'pending' THEN '待处理'
          WHEN 'completed' THEN '已完成'
          ELSE a.status 
        END as '申请状态',
        (SELECT GROUP_CONCAT(DISTINCT i.inspection_date) 
         FROM inspections i WHERE i.application_id = a.id) as '巡检日期',
        (SELECT GROUP_CONCAT(DISTINCT i.inspector) 
         FROM inspections i WHERE i.application_id = a.id) as '巡检人',
        (SELECT COUNT(*) FROM inspection_problems ip 
         JOIN inspections i ON ip.inspection_id = i.id
         WHERE i.application_id = a.id) as '问题总数',
        (SELECT COUNT(*) FROM inspection_problems ip 
         JOIN inspections i ON ip.inspection_id = i.id
         WHERE i.application_id = a.id AND ip.is_rectified = 0) as '未整改问题数',
        (SELECT COUNT(*) FROM property_fees pf 
         WHERE pf.application_id = a.id AND pf.is_paid = 0) as '未结清欠费数',
        (SELECT SUM(pf.amount) FROM property_fees pf 
         WHERE pf.application_id = a.id AND pf.is_paid = 0) as '未结清欠费金额',
        r.refund_no as '退款单号',
        r.total_deposit as '退款-押金总额',
        r.deduction_amount as '退款-扣款金额',
        r.deduction_reason as '退款-扣款原因',
        r.fee_offset_amount as '退款-物业费抵扣',
        r.actual_refund as '退款-实际退款金额',
        r.refund_date as '退款-退款日期',
        r.approver as '退款-审批人',
        r.remarks as '退款-备注',
        a.created_at as '创建时间',
        a.updated_at as '更新时间'
      FROM applications a
      LEFT JOIN refunds r ON r.application_id = a.id AND r.status = 'approved'
    `;
    
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('a.status = ?');
      params.push(filters.status);
    }

    if (filters.keyword) {
      conditions.push('(a.application_no LIKE ? OR a.room_no LIKE ? OR a.owner_name LIKE ?)');
      const like = `%${filters.keyword}%`;
      params.push(like, like, like);
    }

    if (filters.startDate) {
      conditions.push('a.application_date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('a.application_date <= ?');
      params.push(filters.endDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY a.created_at DESC';

    return db.prepare(query).all(...params);
  }

  static getDeductionDetailsData() {
    return db.prepare(`
      SELECT 
        a.application_no as '申请编号',
        a.room_no as '房间号',
        a.owner_name as '业主姓名',
        r.refund_no as '退款单号',
        di.item_type as '扣款项目类型',
        di.description as '扣款项目说明',
        di.amount as '扣款金额',
        di.created_at as '扣款时间'
      FROM deduction_items di
      JOIN refunds r ON di.refund_id = r.id
      JOIN applications a ON r.application_id = a.id
      ORDER BY di.created_at DESC
    `).all();
  }

  static getTimelineData() {
    return db.prepare(`
      SELECT 
        a.application_no as '申请编号',
        a.room_no as '房间号',
        a.owner_name as '业主姓名',
        t.action_type as '操作类型',
        t.action_details as '操作详情',
        t.operator as '操作人',
        t.created_at as '操作时间'
      FROM timeline t
      JOIN applications a ON t.application_id = a.id
      ORDER BY t.created_at DESC
    `).all();
  }

  static exportToExcel(filters = {}) {
    const wb = XLSX.utils.book_new();

    const mainData = this.getExportData(filters);
    const mainWs = XLSX.utils.json_to_sheet(mainData);
    
    const mainCols = [
      { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 13 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 13 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
      { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
      { wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 20 }
    ];
    mainWs['!cols'] = mainCols;
    
    XLSX.utils.book_append_sheet(wb, mainWs, '装修押金退款明细表');

    const deductionData = this.getDeductionDetailsData();
    if (deductionData.length > 0) {
      const deductionWs = XLSX.utils.json_to_sheet(deductionData);
      deductionWs['!cols'] = [
        { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, deductionWs, '扣款明细');
    }

    const timelineData = this.getTimelineData();
    if (timelineData.length > 0) {
      const timelineWs = XLSX.utils.json_to_sheet(timelineData);
      timelineWs['!cols'] = [
        { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 50 }, { wch: 10 }, { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, timelineWs, '操作时间线');
    }

    const summary = this.generateSummary(filters);
    const summaryWs = XLSX.utils.aoa_to_sheet(summary);
    summaryWs['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, '汇总统计');

    return wb;
  }

  static generateSummary(filters = {}) {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_applications,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(deposit_amount) as total_deposit
      FROM applications
      ${filters.status ? 'WHERE status = ?' : ''}
    `).get(filters.status || undefined);

    const refundStats = db.prepare(`
      SELECT 
        COUNT(*) as total_refunds,
        SUM(total_deposit) as refund_total_deposit,
        SUM(deduction_amount) as total_deduction,
        SUM(fee_offset_amount) as total_fee_offset,
        SUM(actual_refund) as total_actual_refund
      FROM refunds
      WHERE status = 'approved'
    `).get();

    const feeStats = db.prepare(`
      SELECT 
        COUNT(*) as unpaid_count,
        SUM(amount) as unpaid_total
      FROM property_fees
      WHERE is_paid = 0
    `).get();

    return [
      ['小区装修押金退还台 - 汇总报表'],
      ['生成时间', new Date().toLocaleString('zh-CN')],
      [],
      ['申请统计'],
      ['指标', '数量', '金额(元)', ''],
      ['总申请数', stats.total_applications, '', ''],
      ['已完成退款', stats.completed_count, '', ''],
      ['待处理', stats.pending_count, '', ''],
      ['押金总额', '', stats.total_deposit?.toFixed(2) || '0.00', ''],
      [],
      ['退款统计'],
      ['指标', '数量', '金额(元)', ''],
      ['已审批退款', refundStats.total_refunds, '', ''],
      ['退款押金总额', '', refundStats.refund_total_deposit?.toFixed(2) || '0.00', ''],
      ['扣款总额', '', refundStats.total_deduction?.toFixed(2) || '0.00', ''],
      ['物业费抵扣总额', '', refundStats.total_fee_offset?.toFixed(2) || '0.00', ''],
      ['实际退款总额', '', refundStats.total_actual_refund?.toFixed(2) || '0.00', ''],
      [],
      ['欠费统计'],
      ['指标', '数量', '金额(元)', ''],
      ['未结清欠费', feeStats.unpaid_count || 0, feeStats.unpaid_total?.toFixed(2) || '0.00', '']
    ];
  }
}

module.exports = ExportService;
