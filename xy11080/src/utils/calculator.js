const { STATUS_LABELS, STANDARD_TEMPS } = require('./constants');

function calculateCompensationSummary(records) {
  const summary = {
    total: records.length,
    compliant: 0,
    nonCompliant: 0,
    needCompensation: 0,
    compensated: 0,
    pending: 0,
    manualReview: 0,
    totalCompensationAmount: 0,
    totalCompensationQuantity: 0,
    byPoolType: {},
    byDate: {}
  };

  records.forEach(record => {
    if (record.is_temp_compliant === 1) {
      summary.compliant++;
    } else {
      summary.nonCompliant++;
    }

    if (record.need_compensation === 1) {
      summary.needCompensation++;
    }

    if (record.status === 'completed') {
      summary.compensated++;
    } else if (record.status === 'pending') {
      summary.pending++;
    } else if (record.status === 'manual_review') {
      summary.manualReview++;
    }

    summary.totalCompensationAmount += record.compensation_amount || 0;
    summary.totalCompensationQuantity += record.compensation_quantity || 0;

    if (!summary.byPoolType[record.pool_type]) {
      summary.byPoolType[record.pool_type] = { total: 0, nonCompliant: 0 };
    }
    summary.byPoolType[record.pool_type].total++;
    if (record.is_temp_compliant === 0) {
      summary.byPoolType[record.pool_type].nonCompliant++;
    }

    if (!summary.byDate[record.record_date]) {
      summary.byDate[record.record_date] = { total: 0, nonCompliant: 0 };
    }
    summary.byDate[record.record_date].total++;
    if (record.is_temp_compliant === 0) {
      summary.byDate[record.record_date].nonCompliant++;
    }
  });

  return summary;
}

function calculateRecordDetail(record) {
  const tempDiff = record.actual_temp - record.standard_temp_min;
  const isTempInRange = record.actual_temp >= record.standard_temp_min && 
                        record.actual_temp <= record.standard_temp_max;
  
  let tempStatus = '正常';
  if (!isTempInRange) {
    tempStatus = record.actual_temp < record.standard_temp_min ? '偏低' : '偏高';
  }

  return {
    ...record,
    status_label: STATUS_LABELS[record.status] || record.status,
    temp_status: tempStatus,
    temp_diff: tempDiff.toFixed(1),
    is_temp_in_range: isTempInRange ? 1 : 0,
    compensation_summary: {
      has_compensation: record.need_compensation === 1,
      type: record.compensation_type,
      amount: record.compensation_amount,
      quantity: record.compensation_quantity
    }
  };
}

function calculateExportRow(record) {
  const detail = calculateRecordDetail(record);
  return {
    记录编号: detail.record_no,
    游泳馆名称: detail.pool_name,
    泳池编号: detail.pool_no,
    泳池类型: detail.pool_type,
    记录日期: detail.record_date,
    时段: detail.time_slot,
    时段时间: `${detail.time_slot_start}-${detail.time_slot_end}`,
    标准水温范围: `${detail.standard_temp_min}℃-${detail.standard_temp_max}℃`,
    实际水温: `${detail.actual_temp}℃`,
    水温状态: detail.temp_status,
    水温温差: `${detail.temp_diff}℃`,
    测量时间: detail.measure_time,
    测量人: detail.measure_person,
    是否达标: detail.is_temp_compliant === 1 ? '是' : '否',
    影响时段: detail.affected_periods || '无',
    课程名称: detail.course_name || '无',
    教练: detail.coach_name || '无',
    报名人数: detail.registered_count,
    到场人数: detail.attended_count,
    是否需要补偿: detail.need_compensation === 1 ? '是' : '否',
    补偿类型: detail.compensation_type || '无',
    补偿金额: detail.compensation_amount,
    补偿数量: detail.compensation_quantity,
    补偿表版本: detail.compensation_table_version || '无',
    补偿表一致性: detail.is_compensation_consistent === 1 ? '一致' : '不一致',
    状态: detail.status_label,
    人工备注: detail.manual_remark || '无',
    审核人: detail.reviewer || '无',
    审核时间: detail.review_time || '无'
  };
}

function calculateMigrationSummary(oldRecords, newRecords) {
  return {
    migrated_count: newRecords.length,
    old_total: oldRecords.length,
    success_count: newRecords.filter(r => r.status !== 'cancelled').length,
    field_mapping: {
      old_system_id: '旧系统ID → 历史记录',
      pool_name: '游泳馆名称 → 直接映射',
      record_date: '记录日期 → 直接映射',
      water_temp: '水温 → actual_temp字段',
      status: '状态 → 转换为新系统状态码',
      remark: '备注 → manual_remark字段'
    },
    status_mapping: {
      '待处理': 'pending',
      '已处理': 'completed',
      '已取消': 'cancelled'
    }
  };
}

module.exports = {
  calculateCompensationSummary,
  calculateRecordDetail,
  calculateExportRow,
  calculateMigrationSummary
};