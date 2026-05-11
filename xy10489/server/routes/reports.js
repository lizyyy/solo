const express = require('express');
const XLSX = require('xlsx');
const { readDB, writeDB, getTimestamp } = require('../database');

function createReportsRouter() {
  const router = express.Router();

  router.get('/monthly', (req, res) => {
    const { year, month } = req.query;
    const now = new Date();
    const reportYear = year || now.getFullYear();
    const reportMonth = month || String(now.getMonth() + 1).padStart(2, '0');

    const datePattern = `${reportYear}-${reportMonth}`;
    const db = readDB();

    const monthlyBatches = db.batches.filter(b => 
      (b.production_date && b.production_date.startsWith(datePattern)) ||
      (b.created_at && b.created_at.startsWith(datePattern))
    );

    const completedBatches = monthlyBatches.filter(b => b.status === '完成').length;
    const scrappedBatches = monthlyBatches.filter(b => b.status === '报废').length;
    const totalQuantity = monthlyBatches.reduce((sum, b) => sum + b.quantity, 0);

    const monthlyDefects = db.defects.filter(d => 
      d.detected_at && d.detected_at.startsWith(datePattern)
    );

    const defectMap = new Map();
    monthlyDefects.forEach(d => {
      const batch = db.batches.find(b => b.id === d.batch_id);
      const key = `${d.defect_type}|${d.severity}|${batch?.production_line || ''}`;
      if (!defectMap.has(key)) {
        defectMap.set(key, {
          defect_type: d.defect_type,
          severity: d.severity,
          defect_count: 0,
          total_quantity: 0,
          product_name: batch?.product_name || '',
          production_line: batch?.production_line || ''
        });
      }
      const stat = defectMap.get(key);
      stat.defect_count++;
      stat.total_quantity += d.quantity;
    });

    const defectStats = Array.from(defectMap.values())
      .sort((a, b) => b.total_quantity - a.total_quantity);

    const totalDefectQuantity = defectStats.reduce((sum, d) => sum + d.total_quantity, 0);

    const monthlyRework = db.rework_records.filter(r => 
      r.rework_start && r.rework_start.startsWith(datePattern)
    );

    const reworkMap = new Map();
    monthlyRework.forEach(r => {
      if (!reworkMap.has(r.rework_method)) {
        reworkMap.set(r.rework_method, {
          rework_method: r.rework_method,
          rework_count: 0,
          total_reworked: 0,
          pass_count: 0,
          fail_count: 0
        });
      }
      const stat = reworkMap.get(r.rework_method);
      stat.rework_count++;
      stat.total_reworked += r.quantity;
      if (r.recheck_result === '合格') stat.pass_count++;
      if (r.recheck_result === '不合格') stat.fail_count++;
    });

    const reworkStats = Array.from(reworkMap.values());

    const monthlyDecisions = db.reinspection_decisions.filter(d => 
      d.decided_at && d.decided_at.startsWith(datePattern)
    );

    const decisionMap = new Map();
    monthlyDecisions.forEach(d => {
      if (!decisionMap.has(d.decision)) {
        decisionMap.set(d.decision, {
          decision: d.decision,
          decision_count: 0,
          total_quantity: 0
        });
      }
      const stat = decisionMap.get(d.decision);
      stat.decision_count++;
      stat.total_quantity += d.quantity;
    });

    const decisionStats = Array.from(decisionMap.values());

    const monthlyQuarantine = db.quarantine.filter(q => 
      q.created_at && q.created_at.startsWith(datePattern)
    );

    const quarantineStats = {
      quarantine_count: monthlyQuarantine.length,
      quarantined: monthlyQuarantine.filter(q => q.status === '隔离中').reduce((sum, q) => sum + q.quantity, 0),
      released: monthlyQuarantine.filter(q => q.status === '已释放').reduce((sum, q) => sum + q.quantity, 0)
    };

    res.json({
      period: { year: reportYear, month: reportMonth },
      summary: {
        total_batches: monthlyBatches.length,
        completed_batches: completedBatches,
        scrapped_batches: scrappedBatches,
        total_quantity: totalQuantity,
        total_defect_quantity: totalDefectQuantity
      },
      defectStats,
      reworkStats,
      decisionStats,
      quarantineStats,
      generatedAt: new Date().toISOString()
    });
  });

  router.get('/monthly/export', (req, res) => {
    const { year, month } = req.query;
    const now = new Date();
    const reportYear = year || now.getFullYear();
    const reportMonth = month || String(now.getMonth() + 1).padStart(2, '0');

    const datePattern = `${reportYear}-${reportMonth}`;
    const db = readDB();

    const monthlyBatches = db.batches.filter(b => 
      (b.production_date && b.production_date.startsWith(datePattern))
    );

    const summary = [
      { metric: '总批次数', value: monthlyBatches.length },
      { metric: '完成批次', value: monthlyBatches.filter(b => b.status === '完成').length },
      { metric: '报废批次', value: monthlyBatches.filter(b => b.status === '报废').length }
    ];

    const defects = db.defects
      .filter(d => d.detected_at && d.detected_at.startsWith(datePattern))
      .map(d => {
        const batch = db.batches.find(b => b.id === d.batch_id);
        return {
          '缺陷类型': d.defect_type,
          '严重程度': d.severity,
          '数量': d.quantity,
          '描述': d.description || '',
          '检测人': d.detected_by,
          '检测时间': d.detected_at,
          '批次号': batch?.batch_no || '',
          '产品名称': batch?.product_name || '',
          '生产线': batch?.production_line || ''
        };
      });

    const decisions = db.reinspection_decisions
      .filter(d => d.decided_at && d.decided_at.startsWith(datePattern))
      .map(d => {
        const batch = db.batches.find(b => b.id === d.batch_id);
        return {
          '批次号': batch?.batch_no || '',
          '产品名称': batch?.product_name || '',
          '复判决定': d.decision,
          '数量': d.quantity,
          '原因': d.reason || '',
          '批准依据': d.approval_basis || '',
          '批准人': d.approved_by,
          '决策时间': d.decided_at
        };
      });

    const rework = db.rework_records
      .filter(r => r.rework_start && r.rework_start.startsWith(datePattern))
      .map(r => {
        const batch = db.batches.find(b => b.id === r.batch_id);
        return {
          '批次号': batch?.batch_no || '',
          '产品名称': batch?.product_name || '',
          '返工方法': r.rework_method,
          '返工数量': r.quantity,
          '返工人': r.reworked_by,
          '开始时间': r.rework_start,
          '复检结果': r.recheck_result || '',
          '复检人': r.rechecked_by || ''
        };
      });

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), '月度汇总');
    if (defects.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(defects), '缺陷记录');
    }
    if (decisions.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(decisions), '复判决定');
    }
    if (rework.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rework), '返工记录');
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=质量月报_${reportYear}${reportMonth}.xlsx`);
    res.send(buffer);
  });

  router.get('/quarantine-status', (req, res) => {
    const db = readDB();

    const records = db.quarantine.map(q => {
      const batch = db.batches.find(b => b.id === q.batch_id);
      return {
        ...q,
        batch_no: batch?.batch_no || '',
        product_name: batch?.product_name || '',
        batch_quantity: batch?.quantity || 0
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const quarantineCount = records.length;
    const quarantinedTotal = records.filter(r => r.status === '隔离中').reduce((sum, r) => sum + r.quantity, 0);
    const releasedTotal = records.filter(r => r.status === '已释放').reduce((sum, r) => sum + r.quantity, 0);

    const summary = [
      { status: '隔离中', count: records.filter(r => r.status === '隔离中').length, total_quantity: quarantinedTotal },
      { status: '已释放', count: records.filter(r => r.status === '已释放').length, total_quantity: releasedTotal }
    ];

    res.json({
      records,
      summary
    });
  });

  router.get('/dashboard', (req, res) => {
    const db = readDB();

    const totalBatches = db.batches.length;
    const activeBatches = db.batches.filter(b => !['完成', '报废'].includes(b.status)).length;
    const totalDefects = db.defects.reduce((sum, d) => sum + d.quantity, 0);
    const quarantinedQty = db.quarantine.filter(q => q.status === '隔离中').reduce((sum, q) => sum + q.quantity, 0);
    const reworkInProgress = db.rework_records.filter(r => r.status === '返工中').length;
    const pendingReinspection = db.batches.filter(b => b.status === '待复判').length;

    const activityList = [
      ...db.batches.map(b => ({
        type: '批次创建',
        reference: b.batch_no,
        description: b.product_name,
        timestamp: b.created_at,
        operator: b.inspector || ''
      })),
      ...db.defects.map(d => ({
        type: '缺陷登记',
        reference: d.defect_type,
        description: `${d.severity} - ${d.quantity}件`,
        timestamp: d.detected_at,
        operator: d.detected_by
      })),
      ...db.reinspection_decisions.map(rd => ({
        type: '复判决定',
        reference: rd.decision,
        description: `${rd.quantity}件 - ${rd.reason || ''}`,
        timestamp: rd.decided_at,
        operator: rd.approved_by
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

    const defectMap = new Map();
    db.defects.forEach(d => {
      const key = `${d.defect_type}|${d.severity}`;
      if (!defectMap.has(key)) {
        defectMap.set(key, {
          defect_type: d.defect_type,
          severity: d.severity,
          total: 0
        });
      }
      defectMap.get(key).total += d.quantity;
    });
    const defectDistribution = Array.from(defectMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const statusMap = new Map();
    db.batches.forEach(b => {
      if (!statusMap.has(b.status)) {
        statusMap.set(b.status, {
          status: b.status,
          count: 0,
          total_quantity: 0
        });
      }
      const stat = statusMap.get(b.status);
      stat.count++;
      stat.total_quantity += b.quantity;
    });
    const batchStatusDistribution = Array.from(statusMap.values());

    res.json({
      stats: {
        totalBatches,
        activeBatches,
        totalDefects,
        quarantinedQty,
        reworkInProgress,
        pendingReinspection
      },
      recentActivity: activityList,
      defectDistribution,
      batchStatusDistribution
    });
  });

  return router;
}

module.exports = { createReportsRouter };
