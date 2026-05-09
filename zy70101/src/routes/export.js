const express = require('express');
const db = require('../db/init');
const { describeStatus } = require('../services/billStateMachine');

const router = express.Router();

router.get('/bill/:id', (req, res) => {
  const { id } = req.params;
  const { format = 'csv' } = req.query;
  
  const bill = db.prepare(`
    SELECT b.*, m.code as meter_code, m.name as meter_name
    FROM bills b
    JOIN meters m ON b.meter_id = m.id
    WHERE b.id = ?
  `).get(id);
  
  if (!bill) {
    return res.status(404).json({ success: false, error: '账单不存在' });
  }
  
  const items = db.prepare(`
    SELECT 
      bi.*,
      t.code as tenant_code,
      t.name as tenant_name
    FROM bill_items bi
    JOIN tenants t ON bi.tenant_id = t.id
    WHERE bi.bill_id = ?
    ORDER BY t.code
  `).all(id);
  
  const logs = db.prepare(`
    SELECT * FROM bill_status_logs 
    WHERE bill_id = ? 
    ORDER BY created_at ASC
  `).all(id);
  
  const rule = db.prepare(`
    SELECT * FROM allocation_rules WHERE version = ?
  `).get(bill.rule_version);
  
  const ruleConfig = rule ? JSON.parse(rule.rule_config) : {};
  
  if (format === 'json') {
    return res.json({
      success: true,
      data: {
        bill_info: {
          period: bill.period,
          meter: `${bill.meter_code} - ${bill.meter_name}`,
          rule_version: bill.rule_version,
          rule_name: rule ? rule.name : '未知',
          price_per_unit: ruleConfig.pricePerUnit,
          loss_ratio: ruleConfig.lossRatio || 0,
          status: bill.status,
          status_desc: describeStatus(bill.status),
          total_consumption: bill.total_consumption,
          total_amount: bill.total_amount,
          generated_at: bill.generated_at,
          confirmed_at: bill.confirmed_at
        },
        details: items.map(i => ({
          租户编码: i.tenant_code,
          租户名称: i.tenant_name,
          面积: i.tenant_area,
          分摊比例: (i.allocation_ratio * 100).toFixed(2) + '%',
          分摊用电量: i.consumption.toFixed(4),
          单价: i.price_per_unit,
          金额: i.amount.toFixed(2)
        })),
        status_history: logs.map(l => ({
          时间: l.created_at,
          操作人: l.operator || '系统',
          从状态: describeStatus(l.from_status),
          到状态: describeStatus(l.to_status),
          原因: l.reason
        }))
      }
    });
  }
  
  let csv = '\ufeff';
  csv += '园区能耗分摊账单\n\n';
  csv += '【基本信息】\n';
  csv += `周期,${bill.period}\n`;
  csv += `电表,${bill.meter_code} - ${bill.meter_name}\n`;
  csv += `分摊规则版本,v${bill.rule_version} (${rule ? rule.name : '未知'})\n`;
  csv += `单价(元/度),${ruleConfig.pricePerUnit}\n`;
  csv += `损耗率,${(ruleConfig.lossRatio || 0) * 100}%\n`;
  csv += `当前状态,${describeStatus(bill.status)}\n`;
  csv += `总用电量(度),${bill.total_consumption?.toFixed(4) || 0}\n`;
  csv += `总金额(元),${bill.total_amount?.toFixed(2) || 0}\n\n`;
  
  csv += '【分摊明细】\n';
  csv += '租户编码,租户名称,面积(㎡),分摊比例,分摊用电量(度),单价(元/度),金额(元)\n';
  items.forEach(i => {
    csv += `${i.tenant_code},${i.tenant_name},${i.tenant_area},`;
    csv += `${(i.allocation_ratio * 100).toFixed(2)}%,${i.consumption.toFixed(4)},`;
    csv += `${i.price_per_unit},${i.amount.toFixed(2)}\n`;
  });
  
  if (logs.length > 0) {
    csv += '\n【状态变更历史】\n';
    csv += '时间,操作人,从状态,到状态,原因\n';
    logs.forEach(l => {
      csv += `${l.created_at},${l.operator || '系统'},`;
      csv += `${describeStatus(l.from_status)},${describeStatus(l.to_status)},${l.reason || ''}\n`;
    });
  }
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bill-${bill.period}.csv"`);
  res.send(csv);
});

router.get('/period/:period', (req, res) => {
  const { period } = req.params;
  
  const bills = db.prepare(`
    SELECT 
      b.*,
      m.code as meter_code,
      m.name as meter_name
    FROM bills b
    JOIN meters m ON b.meter_id = m.id
    WHERE b.period = ?
    ORDER BY m.code
  `).all(period);
  
  if (bills.length === 0) {
    return res.status(404).json({ success: false, error: `${period} 没有账单数据` });
  }
  
  let csv = '\ufeff';
  csv += `${period} 园区能耗汇总\n\n`;
  csv += '电表,当前状态,分摊规则版本,总用电量(度),总金额(元),生成时间,确认时间\n';
  
  let totalConsumption = 0;
  let totalAmount = 0;
  
  bills.forEach(b => {
    totalConsumption += b.total_consumption || 0;
    totalAmount += b.total_amount || 0;
    csv += `${b.meter_code} - ${b.meter_name},${describeStatus(b.status)},`;
    csv += `v${b.rule_version},${b.total_consumption?.toFixed(4) || 0},`;
    csv += `${b.total_amount?.toFixed(2) || 0},${b.generated_at || ''},${b.confirmed_at || ''}\n`;
  });
  
  csv += '\n合计,,';
  csv += `,${totalConsumption.toFixed(4)},${totalAmount.toFixed(2)},\n`;
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="summary-${period}.csv"`);
  res.send(csv);
});

router.get('/disputes', (req, res) => {
  const disputedBills = db.prepare(`
    SELECT 
      b.*,
      m.code as meter_code,
      m.name as meter_name,
      l.reason as dispute_reason,
      l.created_at as disputed_at
    FROM bills b
    JOIN meters m ON b.meter_id = m.id
    JOIN bill_status_logs l ON l.bill_id = b.id AND l.to_status = 'disputed'
    WHERE b.status IN ('disputed', 'dispute_resolved')
    ORDER BY l.created_at DESC
  `).all();
  
  let csv = '\ufeff';
  csv += '账单异议记录\n\n';
  csv += '周期,电表,当前状态,异议时间,异议原因\n';
  
  disputedBills.forEach(b => {
    csv += `${b.period},${b.meter_code} - ${b.meter_name},${describeStatus(b.status)},`;
    csv += `${b.disputed_at},${b.dispute_reason || ''}\n`;
  });
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="disputes.csv"`);
  res.send(csv);
});

module.exports = router;
