const express = require('express');
const router = express.Router();
const { all, get } = require('../config/database');

router.get('/overview', async (req, res, next) => {
  try {
    const [
      totalSpecimens,
      specimensByStatus,
      totalBatches,
      batchesByStatus,
      totalReports,
      reportsByStatus,
      activeChainSegments,
      todayStats
    ] = await Promise.all([
      get('SELECT COUNT(*) as count FROM specimens'),
      all('SELECT status, COUNT(*) as count FROM specimens GROUP BY status'),
      get('SELECT COUNT(*) as count FROM batches'),
      all('SELECT status, COUNT(*) as count FROM batches GROUP BY status'),
      get('SELECT COUNT(*) as count FROM reports'),
      all('SELECT status, COUNT(*) as count FROM reports GROUP BY status'),
      all(`SELECT cs.*, b.batch_number, b.destination_lab
           FROM chain_segments cs
           LEFT JOIN batches b ON cs.batch_id = b.id
           WHERE cs.status = 'in_progress'`),
      getTodayStats()
    ]);

    const specimenStatusMap = {};
    specimensByStatus.forEach(s => {
      specimenStatusMap[s.status] = s.count;
    });

    const batchStatusMap = {};
    batchesByStatus.forEach(b => {
      batchStatusMap[b.status] = b.count;
    });

    const reportStatusMap = {};
    reportsByStatus.forEach(r => {
      reportStatusMap[r.status] = r.count;
    });

    res.json({
      data: {
        summary: {
          total_specimens: totalSpecimens.count,
          total_batches: totalBatches.count,
          total_reports: totalReports.count,
          active_chain_segments: activeChainSegments.length
        },
        specimens_by_status: specimenStatusMap,
        batches_by_status: batchStatusMap,
        reports_by_status: reportStatusMap,
        active_chain_segments: activeChainSegments,
        today_stats: todayStats
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/specimen-timeline/:barcode', async (req, res, next) => {
  try {
    const { barcode } = req.params;

    const specimen = await get(
      `SELECT s.*, b.batch_number, r.report_number, r.status as report_status
       FROM specimens s
       LEFT JOIN batches b ON s.batch_id = b.id
       LEFT JOIN reports r ON s.id = r.specimen_id
       WHERE s.barcode = ?`,
      [barcode]
    );

    if (!specimen) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '标本不存在' } });
    }

    const timeline = [];

    timeline.push({
      step: 1,
      name: '标本登记',
      status: 'completed',
      time: specimen.created_at,
      description: `条码 ${specimen.barcode} 已登记`,
      details: {
        patient_name: specimen.patient_name,
        specimen_type: specimen.specimen_type,
        collection_time: specimen.collection_time
      }
    });

    if (specimen.batch_id) {
      timeline.push({
        step: 2,
        name: '加入批次',
        status: 'completed',
        description: `已加入批次 ${specimen.batch_number}`,
        details: { batch_id: specimen.batch_id }
      });

      const chainSegments = await all(
        `SELECT * FROM chain_segments 
         WHERE batch_id = ? 
         ORDER BY start_time ASC`,
        [specimen.batch_id]
      );

      if (chainSegments.length > 0) {
        timeline.push({
          step: 3,
          name: '冷链运输',
          status: chainSegments.every(s => s.status === 'completed') ? 'completed' : 'in_progress',
          details: {
            segment_count: chainSegments.length,
            segments: chainSegments.map(s => ({
              type: s.segment_type,
              status: s.status,
              start_time: s.start_time,
              end_time: s.end_time,
              temp_range: s.temperature_min !== null ? 
                `${s.temperature_min}°C ~ ${s.temperature_max}°C` : null
            }))
          }
        });
      }

      if (specimen.status === 'delivered' || specimen.status === 'reported' || specimen.status === 'completed') {
        timeline.push({
          step: 4,
          name: '送达确认',
          status: 'completed',
          description: '第三方实验室已签收'
        });
      }

      if (specimen.report_number) {
        timeline.push({
          step: 5,
          name: '报告回传',
          status: specimen.report_status === 'finalized' ? 'completed' : 'in_progress',
          description: `报告 ${specimen.report_number}`,
          details: { report_status: specimen.report_status }
        });
      }
    }

    const overallStatus = getOverallStatus(specimen);

    res.json({
      data: {
        barcode: specimen.barcode,
        patient_name: specimen.patient_name,
        current_status: specimen.status,
        overall_status: overallStatus,
        timeline
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/batch-report/:batchNumber', async (req, res, next) => {
  try {
    const { batchNumber } = req.params;

    const batch = await get('SELECT * FROM batches WHERE batch_number = ?', [batchNumber]);
    
    if (!batch) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '批次不存在' } });
    }

    const [specimens, chainSegments, chainVerification] = await Promise.all([
      all(
        `SELECT s.*, r.report_number, r.status as report_status
         FROM specimens s
         LEFT JOIN reports r ON s.id = r.specimen_id
         WHERE s.batch_id = ?
         ORDER BY s.created_at ASC`,
        [batch.id]
      ),
      all(
        `SELECT * FROM chain_segments 
         WHERE batch_id = ? 
         ORDER BY start_time ASC`,
        [batch.id]
      ),
      verifyBatchColdChain(batch.id)
    ]);

    const specimenSummary = {
      total: specimens.length,
      by_status: {}
    };

    specimens.forEach(s => {
      specimenSummary.by_status[s.status] = (specimenSummary.by_status[s.status] || 0) + 1;
    });

    const reportSummary = {
      total: specimens.filter(s => s.report_number).length,
      finalized: specimens.filter(s => s.report_status === 'finalized').length,
      pending: specimens.filter(s => s.report_status && s.report_status !== 'finalized').length
    };

    res.json({
      data: {
        batch_info: {
          batch_number: batch.batch_number,
          destination_lab: batch.destination_lab,
          courier: batch.courier,
          status: batch.status,
          scheduled_time: batch.scheduled_time,
          actual_shipped_time: batch.actual_shipped_time,
          delivered_time: batch.delivered_time,
          created_at: batch.created_at
        },
        specimens: specimenSummary,
        specimen_details: specimens.map(s => ({
          barcode: s.barcode,
          patient_name: s.patient_name,
          specimen_type: s.specimen_type,
          status: s.status,
          report_number: s.report_number,
          report_status: s.report_status
        })),
        cold_chain: {
          verification: chainVerification,
          segments: chainSegments.map(s => ({
            segment_type: s.segment_type,
            status: s.status,
            start_time: s.start_time,
            end_time: s.end_time,
            start_location: s.start_location,
            end_location: s.end_location,
            temperature_range: s.temperature_min !== null ? {
              min: s.temperature_min,
              max: s.temperature_max,
              avg: s.temperature_avg
            } : null
          }))
        },
        reports: reportSummary,
        overall_progress: calculateBatchProgress(specimens, chainSegments)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/cold-chain-alerts', async (req, res, next) => {
  try {
    const alerts = [];

    const incompleteBatches = await all(
      `SELECT b.batch_number, b.status, COUNT(cs.id) as incomplete_count
       FROM batches b
       LEFT JOIN chain_segments cs ON b.id = cs.batch_id AND cs.status != 'completed'
       WHERE b.status IN ('in_transit', 'delivered')
       GROUP BY b.id
       HAVING incomplete_count > 0`
    );

    incompleteBatches.forEach(b => {
      alerts.push({
        type: 'incomplete_chain',
        severity: 'warning',
        message: `批次 ${b.batch_number} 存在 ${b.incomplete_count} 个未完成的冷链片段`,
        details: { batch_number: b.batch_number }
      });
    });

    const tempViolations = await all(
      `SELECT cs.*, b.batch_number
       FROM chain_segments cs
       LEFT JOIN batches b ON cs.batch_id = b.id
       WHERE cs.status = 'completed'
       AND (cs.temperature_min < -25 OR cs.temperature_max > 8)`
    );

    tempViolations.forEach(cs => {
      const issues = [];
      if (cs.temperature_min < -25) issues.push(`最低温度 ${cs.temperature_min}°C 低于 -25°C`);
      if (cs.temperature_max > 8) issues.push(`最高温度 ${cs.temperature_max}°C 高于 8°C`);
      
      alerts.push({
        type: 'temperature_violation',
        severity: 'error',
        message: `批次 ${cs.batch_number} 冷链片段温度异常`,
        details: {
          batch_number: cs.batch_number,
          segment_type: cs.segment_type,
          issues
        }
      });
    });

    const pendingReports = await all(
      `SELECT s.barcode, s.patient_name, b.batch_number
       FROM specimens s
       LEFT JOIN batches b ON s.batch_id = b.id
       LEFT JOIN reports r ON s.id = r.specimen_id
       WHERE s.status = 'delivered' AND r.id IS NULL`
    );

    if (pendingReports.length > 0) {
      alerts.push({
        type: 'pending_reports',
        severity: 'info',
        message: `有 ${pendingReports.length} 个标本已送达但尚未创建报告`,
        details: {
          count: pendingReports.length,
          specimens: pendingReports.map(s => ({
            barcode: s.barcode,
            patient_name: s.patient_name,
            batch_number: s.batch_number
          }))
        }
      });
    }

    res.json({
      data: {
        total_alerts: alerts.length,
        alerts
      }
    });
  } catch (err) {
    next(err);
  }
});

async function getTodayStats() {
  const today = new Date().toISOString().slice(0, 10);
  
  const [newSpecimens, shippedBatches, newReports] = await Promise.all([
    get(`SELECT COUNT(*) as count FROM specimens WHERE DATE(created_at) = ?`, [today]),
    get(`SELECT COUNT(*) as count FROM batches WHERE DATE(actual_shipped_time) = ?`, [today]),
    get(`SELECT COUNT(*) as count FROM reports WHERE DATE(created_at) = ?`, [today])
  ]);

  return {
    new_specimens: newSpecimens.count,
    shipped_batches: shippedBatches.count,
    new_reports: newReports.count
  };
}

async function verifyBatchColdChain(batchId) {
  const segments = await all(
    `SELECT * FROM chain_segments WHERE batch_id = ?`,
    [batchId]
  );

  if (segments.length === 0) {
    return { verified: false, reason: '无冷链记录' };
  }

  const incomplete = segments.filter(s => s.status !== 'completed');
  const tempViolations = segments.filter(s => 
    (s.temperature_min !== null && s.temperature_min < -25) ||
    (s.temperature_max !== null && s.temperature_max > 8)
  );

  return {
    verified: incomplete.length === 0 && tempViolations.length === 0,
    segment_count: segments.length,
    incomplete_count: incomplete.length,
    temperature_violations: tempViolations.length
  };
}

function getOverallStatus(specimen) {
  const statusOrder = [
    'created', 'in_batch', 'shipped', 'in_transit', 'delivered', 'reported', 'completed'
  ];
  const currentIndex = statusOrder.indexOf(specimen.status);
  return {
    current_step: currentIndex + 1,
    total_steps: 6,
    progress: Math.round(((currentIndex + 1) / 6) * 100)
  };
}

function calculateBatchProgress(specimens, chainSegments) {
  const totalSpecimens = specimens.length;
  if (totalSpecimens === 0) return 0;

  const completedSpecimens = specimens.filter(s => s.status === 'completed').length;
  const chainComplete = chainSegments.length > 0 && 
    chainSegments.every(s => s.status === 'completed');

  const specimenProgress = (completedSpecimens / totalSpecimens) * 70;
  const chainProgress = chainComplete ? 30 : (chainSegments.filter(s => s.status === 'completed').length / Math.max(chainSegments.length, 1)) * 30;

  return Math.round(specimenProgress + chainProgress);
}

module.exports = router;
