const db = require('../config/database');
const { format } = require('date-fns');
const { getStateDisplayName } = require('./bookingStateService');

function getShiftHandoverData(date) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const bookings = db.prepare(`
    SELECT b.*, 
           r.name as room_name,
           c.name as customer_name, c.phone as customer_phone
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN customers c ON b.customer_id = c.id
    WHERE b.start_time < ? AND b.end_time > ?
    ORDER BY b.start_time
  `).all(endOfDay.toISOString(), startOfDay.toISOString());
  
  const bookingsWithDevices = bookings.map(booking => {
    const devices = db.prepare(`
      SELECT bd.*, d.name as device_name
      FROM booking_devices bd
      JOIN devices d ON bd.device_id = d.id
      WHERE bd.booking_id = ?
    `).all(booking.id);
    return { ...booking, devices };
  });
  
  const depositTransactions = db.prepare(`
    SELECT dt.*, b.booking_number
    FROM deposit_transactions dt
    JOIN bookings b ON dt.booking_id = b.id
    WHERE DATE(dt.created_at) = DATE(?)
    ORDER BY dt.created_at
  `).all(targetDate);
  
  const damageRecords = db.prepare(`
    SELECT dr.*, 
           d.name as device_name, 
           r.name as room_name,
           b.booking_number
    FROM damage_records dr
    LEFT JOIN devices d ON dr.device_id = d.id
    LEFT JOIN rooms r ON dr.room_id = r.id
    JOIN bookings b ON dr.booking_id = b.id
    WHERE DATE(dr.created_at) = DATE(?)
    ORDER BY dr.created_at
  `).all(targetDate);
  
  const summary = {
    date: targetDate,
    totalBookings: bookings.length,
    byStatus: {},
    totalRevenue: 0,
    totalDepositCollected: 0,
    totalRefund: 0,
    totalAdditionalPayment: 0,
    pendingDamageRecords: damageRecords.filter(d => d.status === 'reported').length
  };
  
  bookings.forEach(b => {
    const statusName = getStateDisplayName(b.status);
    summary.byStatus[statusName] = (summary.byStatus[statusName] || 0) + 1;
    if (b.status === 'settled') {
      summary.totalRevenue += b.total_amount;
    }
  });
  
  depositTransactions.forEach(t => {
    if (t.transaction_type === 'deposit') {
      summary.totalDepositCollected += t.amount;
    } else if (t.transaction_type === 'refund') {
      summary.totalRefund += Math.abs(t.amount);
    } else if (t.transaction_type === 'additional_payment') {
      summary.totalAdditionalPayment += t.amount;
    }
  });
  
  return {
    date: targetDate,
    summary,
    bookings: bookingsWithDevices,
    depositTransactions,
    damageRecords
  };
}

function getDailyReconciliationData(date) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const settledBookings = db.prepare(`
    SELECT b.*, 
           r.name as room_name,
           c.name as customer_name
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN customers c ON b.customer_id = c.id
    WHERE b.status = 'settled'
    AND DATE(b.updated_at) = DATE(?)
    ORDER BY b.updated_at
  `).all(targetDate);
  
  const depositTransactions = db.prepare(`
    SELECT dt.*, b.booking_number, c.name as customer_name
    FROM deposit_transactions dt
    JOIN bookings b ON dt.booking_id = b.id
    JOIN customers c ON b.customer_id = c.id
    WHERE DATE(dt.created_at) = DATE(?)
    ORDER BY dt.created_at
  `).all(targetDate);
  
  let totalRoomRevenue = 0;
  let totalDeviceRevenue = 0;
  let totalOvertimeRevenue = 0;
  let totalDamageRevenue = 0;
  let totalDepositCollected = 0;
  let totalRefund = 0;
  let totalAdditionalPayment = 0;
  
  settledBookings.forEach(b => {
    totalRoomRevenue += b.base_amount || 0;
    totalDeviceRevenue += b.device_amount || 0;
    totalOvertimeRevenue += b.overtime_amount || 0;
    totalDamageRevenue += b.damage_amount || 0;
  });
  
  depositTransactions.forEach(t => {
    if (t.transaction_type === 'deposit') {
      totalDepositCollected += t.amount;
    } else if (t.transaction_type === 'refund') {
      totalRefund += Math.abs(t.amount);
    } else if (t.transaction_type === 'additional_payment') {
      totalAdditionalPayment += t.amount;
    }
  });
  
  const totalRevenue = totalRoomRevenue + totalDeviceRevenue + totalOvertimeRevenue + totalDamageRevenue;
  const netCashFlow = totalDepositCollected + totalAdditionalPayment - totalRefund;
  
  return {
    date: targetDate,
    summary: {
      totalSettledBookings: settledBookings.length,
      totalRoomRevenue: Number(totalRoomRevenue.toFixed(2)),
      totalDeviceRevenue: Number(totalDeviceRevenue.toFixed(2)),
      totalOvertimeRevenue: Number(totalOvertimeRevenue.toFixed(2)),
      totalDamageRevenue: Number(totalDamageRevenue.toFixed(2)),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalDepositCollected: Number(totalDepositCollected.toFixed(2)),
      totalRefund: Number(totalRefund.toFixed(2)),
      totalAdditionalPayment: Number(totalAdditionalPayment.toFixed(2)),
      netCashFlow: Number(netCashFlow.toFixed(2))
    },
    settledBookings,
    depositTransactions
  };
}

function getRepairTodoData(date) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const pendingDamages = db.prepare(`
    SELECT dr.*, 
           d.name as device_name, d.model as device_model, d.category as device_category,
           r.name as room_name,
           b.booking_number, b.start_time as booking_start_time,
           c.name as customer_name
    FROM damage_records dr
    LEFT JOIN devices d ON dr.device_id = d.id
    LEFT JOIN rooms r ON dr.room_id = r.id
    JOIN bookings b ON dr.booking_id = b.id
    JOIN customers c ON b.customer_id = c.id
    WHERE dr.status IN ('reported', 'in_repair')
    ORDER BY dr.created_at
  `).all();
  
  const summary = {
    date: targetDate,
    totalPending: pendingDamages.length,
    byType: {},
    byStatus: {},
    totalEstimatedCost: 0
  };
  
  pendingDamages.forEach(d => {
    summary.byType[d.damage_type] = (summary.byType[d.damage_type] || 0) + 1;
    summary.byStatus[d.status] = (summary.byStatus[d.status] || 0) + 1;
    summary.totalEstimatedCost += d.estimated_cost || 0;
  });
  
  return {
    date: targetDate,
    summary: {
      ...summary,
      totalEstimatedCost: Number(summary.totalEstimatedCost.toFixed(2))
    },
    damageRecords: pendingDamages
  };
}

function toJSON(data) {
  return JSON.stringify(data, null, 2);
}

function toMarkdownShiftHandover(data) {
  let md = `# 班次交接清单 - ${data.date}\n\n`;
  
  md += `## 今日摘要\n\n`;
  md += `| 项目 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 总预约数 | ${data.summary.totalBookings} |\n`;
  md += `| 已结算收入 | ¥${data.summary.totalRevenue.toFixed(2)} |\n`;
  md += `| 押金收取 | ¥${data.summary.totalDepositCollected.toFixed(2)} |\n`;
  md += `| 押金退还 | ¥${data.summary.totalRefund.toFixed(2)} |\n`;
  md += `| 补收费用 | ¥${data.summary.totalAdditionalPayment.toFixed(2)} |\n`;
  md += `| 待处理损耗 | ${data.summary.pendingDamageRecords} 项 |\n\n`;
  
  md += `### 预约状态分布\n\n`;
  Object.entries(data.summary.byStatus).forEach(([status, count]) => {
    md += `- ${status}: ${count} 个\n`;
  });
  md += `\n`;
  
  md += `## 今日预约明细\n\n`;
  if (data.bookings.length === 0) {
    md += `暂无预约\n\n`;
  } else {
    data.bookings.forEach((booking, index) => {
      md += `### 预约 ${index + 1}: ${booking.booking_number}\n\n`;
      md += `- **客户**: ${booking.customer_name} (${booking.customer_phone || '无电话'})\n`;
      md += `- **房间**: ${booking.room_name}\n`;
      md += `- **时间**: ${format(new Date(booking.start_time), 'HH:mm')} - ${format(new Date(booking.end_time), 'HH:mm')}\n`;
      md += `- **状态**: ${getStateDisplayName(booking.status)}\n`;
      md += `- **金额**: 基础 ¥${booking.base_amount.toFixed(2)}`;
      if (booking.device_amount > 0) md += ` + 设备 ¥${booking.device_amount.toFixed(2)}`;
      if (booking.overtime_amount > 0) md += ` + 超时 ¥${booking.overtime_amount.toFixed(2)}`;
      if (booking.damage_amount > 0) md += ` + 损耗 ¥${booking.damage_amount.toFixed(2)}`;
      md += ` = **总计 ¥${booking.total_amount.toFixed(2)}**\n`;
      
      if (booking.devices && booking.devices.length > 0) {
        md += `- **设备**: ${booking.devices.map(d => d.device_name).join('、')}\n`;
      }
      if (booking.notes) {
        md += `- **备注**: ${booking.notes}\n`;
      }
      md += `\n`;
    });
  }
  
  md += `## 押金流水\n\n`;
  if (data.depositTransactions.length === 0) {
    md += `今日无押金流水\n\n`;
  } else {
    md += `| 时间 | 预约号 | 类型 | 金额 | 支付方式 | 备注 |\n`;
    md += `|------|--------|------|------|----------|------|\n`;
    data.depositTransactions.forEach(t => {
      const typeName = t.transaction_type === 'deposit' ? '收取' : 
                       t.transaction_type === 'refund' ? '退还' : '补收';
      const amount = t.transaction_type === 'refund' ? `¥${Math.abs(t.amount).toFixed(2)}` : `¥${t.amount.toFixed(2)}`;
      md += `| ${format(new Date(t.created_at), 'HH:mm')} | ${t.booking_number} | ${typeName} | ${amount} | ${t.payment_method || '-'} | ${t.notes || '-'} |\n`;
    });
    md += `\n`;
  }
  
  md += `## 今日损耗记录\n\n`;
  if (data.damageRecords.length === 0) {
    md += `今日无损耗记录\n\n`;
  } else {
    data.damageRecords.forEach((d, index) => {
      md += `### 损耗 ${index + 1}\n\n`;
      md += `- **预约号**: ${d.booking_number}\n`;
      md += `- **类型**: ${d.damage_type}\n`;
      if (d.device_name) md += `- **设备**: ${d.device_name}\n`;
      if (d.room_name) md += `- **房间**: ${d.room_name}\n`;
      md += `- **描述**: ${d.description}\n`;
      md += `- **预估费用**: ¥${(d.estimated_cost || 0).toFixed(2)}\n`;
      md += `- **状态**: ${d.status === 'reported' ? '已报告' : d.status === 'in_repair' ? '维修中' : '已解决'}\n\n`;
    });
  }
  
  return md;
}

function toMarkdownDailyReconciliation(data) {
  let md = `# 日结对账单 - ${data.date}\n\n`;
  
  md += `## 收入汇总\n\n`;
  md += `| 收入类型 | 金额 |\n`;
  md += `|----------|------|\n`;
  md += `| 房间使用 | ¥${data.summary.totalRoomRevenue.toFixed(2)} |\n`;
  md += `| 设备租赁 | ¥${data.summary.totalDeviceRevenue.toFixed(2)} |\n`;
  md += `| 超时费用 | ¥${data.summary.totalOvertimeRevenue.toFixed(2)} |\n`;
  md += `| 损耗赔偿 | ¥${data.summary.totalDamageRevenue.toFixed(2)} |\n`;
  md += `| **总计** | **¥${data.summary.totalRevenue.toFixed(2)}** |\n\n`;
  
  md += `## 现金流\n\n`;
  md += `| 项目 | 金额 |\n`;
  md += `|------|------|\n`;
  md += `| 押金收取 | ¥${data.summary.totalDepositCollected.toFixed(2)} |\n`;
  md += `| 补收费用 | ¥${data.summary.totalAdditionalPayment.toFixed(2)} |\n`;
  md += `| 押金退还 | -¥${data.summary.totalRefund.toFixed(2)} |\n`;
  md += `| **净现金流** | **¥${data.summary.netCashFlow.toFixed(2)}** |\n\n`;
  
  md += `## 已结算预约 (${data.settledBookings.length} 个)\n\n`;
  if (data.settledBookings.length === 0) {
    md += `今日无已结算预约\n\n`;
  } else {
    data.settledBookings.forEach((b, index) => {
      md += `### ${index + 1}. ${b.booking_number}\n\n`;
      md += `- **客户**: ${b.customer_name}\n`;
      md += `- **房间**: ${b.room_name}\n`;
      md += `- **时间**: ${format(new Date(b.start_time), 'HH:mm')} - ${format(new Date(b.end_time), 'HH:mm')}\n`;
      md += `- **费用明细**:\n`;
      md += `  - 房间: ¥${b.base_amount.toFixed(2)}\n`;
      if (b.device_amount > 0) md += `  - 设备: ¥${b.device_amount.toFixed(2)}\n`;
      if (b.overtime_amount > 0) md += `  - 超时: ¥${b.overtime_amount.toFixed(2)}\n`;
      if (b.damage_amount > 0) md += `  - 损耗: ¥${b.damage_amount.toFixed(2)}\n`;
      md += `  - **总计**: ¥${b.total_amount.toFixed(2)}\n\n`;
    });
  }
  
  md += `## 今日押金流水\n\n`;
  if (data.depositTransactions.length === 0) {
    md += `今日无押金流水\n\n`;
  } else {
    md += `| 时间 | 预约号 | 客户 | 类型 | 金额 | 支付方式 |\n`;
    md += `|------|--------|------|------|------|----------|\n`;
    data.depositTransactions.forEach(t => {
      const typeName = t.transaction_type === 'deposit' ? '收取' : 
                       t.transaction_type === 'refund' ? '退还' : '补收';
      const amount = t.transaction_type === 'refund' ? `¥${Math.abs(t.amount).toFixed(2)}` : `¥${t.amount.toFixed(2)}`;
      md += `| ${format(new Date(t.created_at), 'HH:mm')} | ${t.booking_number} | ${t.customer_name} | ${typeName} | ${amount} | ${t.payment_method || '-'} |\n`;
    });
    md += `\n`;
  }
  
  return md;
}

function toMarkdownRepairTodo(data) {
  let md = `# 设备维修待办清单 - ${data.date}\n\n`;
  
  md += `## 待处理损耗汇总\n\n`;
  md += `| 项目 | 数量/金额 |\n`;
  md += `|------|----------|\n`;
  md += `| 待处理总数 | ${data.summary.totalPending} 项 |\n`;
  md += `| 预估总费用 | ¥${data.summary.totalEstimatedCost.toFixed(2)} |\n\n`;
  
  md += `### 按类型分布\n\n`;
  Object.entries(data.summary.byType).forEach(([type, count]) => {
    md += `- ${type}: ${count} 项\n`;
  });
  md += `\n`;
  
  md += `### 按状态分布\n\n`;
  Object.entries(data.summary.byStatus).forEach(([status, count]) => {
    const statusName = status === 'reported' ? '已报告' : status === 'in_repair' ? '维修中' : status;
    md += `- ${statusName}: ${count} 项\n`;
  });
  md += `\n`;
  
  md += `## 待处理损耗明细\n\n`;
  if (data.damageRecords.length === 0) {
    md += `暂无待处理损耗\n\n`;
  } else {
    data.damageRecords.forEach((d, index) => {
      md += `### ${index + 1}. 损耗记录 #${d.id}\n\n`;
      md += `- **预约号**: ${d.booking_number}\n`;
      md += `- **客户**: ${d.customer_name}\n`;
      md += `- **类型**: ${d.damage_type}\n`;
      if (d.device_name) {
        md += `- **设备**: ${d.device_name} (${d.device_category || '未分类'})\n`;
        if (d.device_model) md += `- **型号**: ${d.device_model}\n`;
      }
      if (d.room_name) md += `- **房间**: ${d.room_name}\n`;
      md += `- **描述**: ${d.description}\n`;
      md += `- **预估费用**: ¥${(d.estimated_cost || 0).toFixed(2)}\n`;
      md += `- **状态**: ${d.status === 'reported' ? '已报告' : d.status === 'in_repair' ? '维修中' : '已解决'}\n`;
      if (d.reported_by) md += `- **报告人**: ${d.reported_by}\n`;
      md += `- **报告时间**: ${format(new Date(d.created_at), 'yyyy-MM-dd HH:mm')}\n`;
      if (d.notes) md += `- **备注**: ${d.notes}\n`;
      md += `\n`;
    });
  }
  
  return md;
}

function toCSVShiftHandover(data) {
  let csv = '\ufeff';
  
  csv += `日期,${data.date}\n\n`;
  
  csv += `预约明细表\n`;
  csv += `预约号,客户,电话,房间,开始时间,结束时间,状态,基础金额,设备金额,超时金额,损耗金额,总金额,设备,备注\n`;
  
  data.bookings.forEach(b => {
    const deviceNames = b.devices ? b.devices.map(d => d.device_name).join(';') : '';
    csv += `${b.booking_number},${b.customer_name},${b.customer_phone || ''},${b.room_name},`;
    csv += `${format(new Date(b.start_time), 'yyyy-MM-dd HH:mm')},${format(new Date(b.end_time), 'yyyy-MM-dd HH:mm')},`;
    csv += `${getStateDisplayName(b.status)},${b.base_amount.toFixed(2)},${b.device_amount.toFixed(2)},`;
    csv += `${b.overtime_amount.toFixed(2)},${b.damage_amount.toFixed(2)},${b.total_amount.toFixed(2)},`;
    csv += `${deviceNames},"${b.notes || ''}"\n`;
  });
  
  csv += `\n押金流水\n`;
  csv += `时间,预约号,类型,金额,支付方式,备注\n`;
  
  data.depositTransactions.forEach(t => {
    const typeName = t.transaction_type === 'deposit' ? '收取' : 
                     t.transaction_type === 'refund' ? '退还' : '补收';
    csv += `${format(new Date(t.created_at), 'yyyy-MM-dd HH:mm')},${t.booking_number},${typeName},`;
    csv += `${t.amount.toFixed(2)},${t.payment_method || ''},"${t.notes || ''}"\n`;
  });
  
  csv += `\n损耗记录\n`;
  csv += `时间,预约号,类型,设备/房间,描述,预估费用,状态\n`;
  
  data.damageRecords.forEach(d => {
    const itemName = d.device_name || d.room_name || '';
    const statusName = d.status === 'reported' ? '已报告' : d.status === 'in_repair' ? '维修中' : '已解决';
    csv += `${format(new Date(d.created_at), 'yyyy-MM-dd HH:mm')},${d.booking_number},${d.damage_type},`;
    csv += `${itemName},"${d.description}",${(d.estimated_cost || 0).toFixed(2)},${statusName}\n`;
  });
  
  return csv;
}

function toCSVDailyReconciliation(data) {
  let csv = '\ufeff';
  
  csv += `日结对账单,${data.date}\n\n`;
  
  csv += `收入汇总\n`;
  csv += `类型,金额\n`;
  csv += `房间使用,${data.summary.totalRoomRevenue.toFixed(2)}\n`;
  csv += `设备租赁,${data.summary.totalDeviceRevenue.toFixed(2)}\n`;
  csv += `超时费用,${data.summary.totalOvertimeRevenue.toFixed(2)}\n`;
  csv += `损耗赔偿,${data.summary.totalDamageRevenue.toFixed(2)}\n`;
  csv += `总计,${data.summary.totalRevenue.toFixed(2)}\n\n`;
  
  csv += `已结算预约\n`;
  csv += `预约号,客户,房间,开始时间,结束时间,房间费用,设备费用,超时费用,损耗费用,总费用\n`;
  
  data.settledBookings.forEach(b => {
    csv += `${b.booking_number},${b.customer_name},${b.room_name},`;
    csv += `${format(new Date(b.start_time), 'yyyy-MM-dd HH:mm')},${format(new Date(b.end_time), 'yyyy-MM-dd HH:mm')},`;
    csv += `${b.base_amount.toFixed(2)},${b.device_amount.toFixed(2)},${b.overtime_amount.toFixed(2)},`;
    csv += `${b.damage_amount.toFixed(2)},${b.total_amount.toFixed(2)}\n`;
  });
  
  csv += `\n押金流水\n`;
  csv += `时间,预约号,客户,类型,金额,支付方式\n`;
  
  data.depositTransactions.forEach(t => {
    const typeName = t.transaction_type === 'deposit' ? '收取' : 
                     t.transaction_type === 'refund' ? '退还' : '补收';
    csv += `${format(new Date(t.created_at), 'yyyy-MM-dd HH:mm')},${t.booking_number},${t.customer_name},`;
    csv += `${typeName},${t.amount.toFixed(2)},${t.payment_method || ''}\n`;
  });
  
  return csv;
}

function toCSVRepairTodo(data) {
  let csv = '\ufeff';
  
  csv += `设备维修待办清单,${data.date}\n\n`;
  
  csv += `待处理损耗明细\n`;
  csv += `序号,预约号,客户,损耗类型,设备名称,设备型号,设备分类,房间,描述,预估费用,状态,报告时间\n`;
  
  data.damageRecords.forEach((d, index) => {
    const statusName = d.status === 'reported' ? '已报告' : d.status === 'in_repair' ? '维修中' : '已解决';
    csv += `${index + 1},${d.booking_number},${d.customer_name},${d.damage_type},`;
    csv += `${d.device_name || ''},${d.device_model || ''},${d.device_category || ''},${d.room_name || ''},`;
    csv += `"${d.description}",${(d.estimated_cost || 0).toFixed(2)},${statusName},`;
    csv += `${format(new Date(d.created_at), 'yyyy-MM-dd HH:mm')}\n`;
  });
  
  return csv;
}

module.exports = {
  getShiftHandoverData,
  getDailyReconciliationData,
  getRepairTodoData,
  toJSON,
  toMarkdownShiftHandover,
  toMarkdownDailyReconciliation,
  toMarkdownRepairTodo,
  toCSVShiftHandover,
  toCSVDailyReconciliation,
  toCSVRepairTodo
};
