const { getDbSync } = require('../db/connection');
const { getBatchInventory } = require('./batchService');

function getCount(db, table) {
  const result = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get();
  return result && result.cnt !== undefined ? result.cnt : 0;
}

function generateInventoryReport() {
  const db = getDbSync();
  
  const batchInventory = getBatchInventory();
  
  const totalBatches = getCount(db, 'frozen_batches');
  const totalDonations = getCount(db, 'donations');
  const totalTests = getCount(db, 'test_results');
  const totalDistributions = getCount(db, 'distribution_records');
  const totalRecalls = getCount(db, 'recall_records');

  const donationsByStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM donations
    GROUP BY status
  `).all();

  const testsByResult = db.prepare(`
    SELECT result, COUNT(*) as count
    FROM test_results
    WHERE status = 'completed'
    GROUP BY result
  `).all();

  const freezers = db.prepare(`
    SELECT 
      freezer_location,
      COUNT(*) as batch_count,
      SUM(volume_ml) as total_volume,
      SUM(CASE WHEN status = 'frozen' THEN 1 ELSE 0 END) as available_batches,
      SUM(CASE WHEN status = 'frozen' THEN volume_ml ELSE 0 END) as available_volume
    FROM frozen_batches
    GROUP BY freezer_location
  `).all();

  const expirySummary = db.prepare(`
    SELECT 
      CASE 
        WHEN date(expiry_date) <= date('now', '+30 days') THEN 'expiring_30_days'
        WHEN date(expiry_date) <= date('now', '+90 days') THEN 'expiring_90_days'
        ELSE 'safe'
      END as expiry_category,
      COUNT(*) as batch_count,
      SUM(volume_ml) as total_volume
    FROM frozen_batches
    WHERE status IN ('frozen', 'partial_distributed')
    GROUP BY expiry_category
  `).all();

  const donorStats = db.prepare(`
    SELECT 
      d.donor_id,
      COUNT(d.id) as donation_count,
      SUM(d.quantity_ml) as total_donated,
      SUM(CASE WHEN d.status = 'frozen' OR d.status = 'distributed' THEN d.quantity_ml ELSE 0 END) as usable_volume
    FROM donations d
    GROUP BY d.donor_id
    ORDER BY total_donated DESC
  `).all();

  const recipientStats = db.prepare(`
    SELECT 
      recipient_id,
      COUNT(*) as distribution_count,
      SUM(distributed_quantity_ml) as total_received
    FROM distribution_records
    WHERE verification_status = 'verified'
    GROUP BY recipient_id
    ORDER BY total_received DESC
  `).all();

  const testPassRate = totalTests > 0 
    ? (testsByResult.find(t => t.result === 'negative')?.count || 0) / totalTests * 100 
    : 0;

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_donations: totalDonations,
      total_batches: totalBatches,
      total_tests: totalTests,
      total_distributions: totalDistributions,
      total_recalls: totalRecalls
    },
    batch_inventory: batchInventory,
    donations_by_status: donationsByStatus.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {}),
    tests_by_result: testsByResult.reduce((acc, item) => {
      acc[item.result] = item.count;
      return acc;
    }, {}),
    test_pass_rate: Math.round(testPassRate * 100) / 100,
    freezers: freezers,
    expiry_warnings: expirySummary,
    top_donors: donorStats.slice(0, 10),
    top_recipients: recipientStats.slice(0, 10)
  };
}

function generateBatchDetailReport(batchId) {
  const db = getDbSync();
  
  const batch = db.prepare('SELECT * FROM frozen_batches WHERE id = ?').get(batchId);
  if (!batch) {
    return null;
  }

  const donation = db.prepare('SELECT * FROM donations WHERE id = ?').get(batch.donation_id);
  const tests = db.prepare(`
    SELECT * FROM test_results 
    WHERE donation_id = ? AND status = 'completed'
    ORDER BY test_type
  `).all(batch.donation_id);
  
  const distributions = db.prepare(`
    SELECT * FROM distribution_records 
    WHERE batch_id = ?
    ORDER BY distribution_date DESC
  `).all(batchId);
  
  const recalls = db.prepare(`
    SELECT * FROM recall_records 
    WHERE batch_id = ?
    ORDER BY recall_date DESC
  `).all(batchId);

  const totalDistributed = distributions.reduce((sum, d) => sum + d.distributed_quantity_ml, 0);
  const totalContainersUsed = distributions.reduce((sum, d) => sum + d.containers_used, 0);
  const verifiedDistributions = distributions.filter(d => d.verification_status === 'verified');

  const testSummary = {
    total: tests.length,
    passed: tests.filter(t => t.result === 'negative').length,
    failed: tests.filter(t => t.result === 'positive').length,
    inconclusive: tests.filter(t => t.result === 'inconclusive').length
  };

  const allTestsPassed = tests.length > 0 && testSummary.failed === 0 && testSummary.inconclusive === 0;

  const recipients = [...new Set(distributions.map(d => d.recipient_id))];

  return {
    generated_at: new Date().toISOString(),
    batch: {
      id: batch.id,
      batch_code: batch.batch_code,
      status: batch.status,
      container_type: batch.container_type,
      container_count: batch.container_count,
      volume_ml: batch.volume_ml,
      freezer_location: batch.freezer_location,
      freezer_level: batch.freezer_level,
      freeze_date: batch.freeze_date,
      expiry_date: batch.expiry_date
    },
    donor: {
      donor_id: donation?.donor_id,
      donation_date: donation?.donation_date,
      donation_quantity: donation?.quantity_ml,
      donation_status: donation?.status
    },
    testing: {
      all_tests_passed: allTestsPassed,
      summary: testSummary,
      details: tests
    },
    distribution: {
      total_distributed_ml: totalDistributed,
      available_ml: batch.volume_ml - totalDistributed,
      containers_used: totalContainersUsed,
      containers_available: batch.container_count - totalContainersUsed,
      distribution_count: distributions.length,
      verified_count: verifiedDistributions.length,
      unique_recipients: recipients.length,
      recipients: recipients,
      details: distributions
    },
    recalls: {
      total_recalls: recalls.length,
      details: recalls
    },
    risk_assessment: {
      has_active_recall: recalls.some(r => ['in_progress', 'partial'].includes(r.status)),
      expired: new Date(batch.expiry_date) < new Date(),
      test_failed: !allTestsPassed,
      overall_risk: calculateRisk(batch, testSummary, recalls)
    }
  };
}

function calculateRisk(batch, testSummary, recalls) {
  let risk = 'low';
  let reasons = [];

  if (testSummary.failed > 0) {
    risk = 'critical';
    reasons.push('检测存在阳性结果');
  }

  if (testSummary.inconclusive > 0) {
    risk = risk === 'critical' ? 'critical' : 'high';
    reasons.push('存在不确定的检测结果');
  }

  if (recalls.some(r => ['in_progress', 'partial'].includes(r.status))) {
    risk = risk === 'critical' ? 'critical' : 'high';
    reasons.push('存在未完成的召回');
  }

  if (new Date(batch.expiry_date) < new Date()) {
    risk = risk === 'critical' ? 'critical' : (risk === 'high' ? 'high' : 'medium');
    reasons.push('批次已过期');
  }

  return {
    level: risk,
    reasons: reasons
  };
}

function generateDonationTraceReport(donationId) {
  const db = getDbSync();
  
  const donation = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId);
  if (!donation) {
    return null;
  }

  const tests = db.prepare('SELECT * FROM test_results WHERE donation_id = ?').all(donationId);
  const batches = db.prepare('SELECT * FROM frozen_batches WHERE donation_id = ?').all(donationId);
  
  const batchIds = batches.map(b => b.id);
  
  let distributions = [];
  let recalls = [];
  
  if (batchIds.length > 0) {
    const placeholders = batchIds.map(() => '?').join(',');
    distributions = db.prepare(
      `SELECT dr.*, fb.batch_code 
       FROM distribution_records dr 
       JOIN frozen_batches fb ON dr.batch_id = fb.id 
       WHERE dr.batch_id IN (${placeholders})`
    ).all(...batchIds);
    
    recalls = db.prepare(
      `SELECT rr.*, fb.batch_code 
       FROM recall_records rr 
       JOIN frozen_batches fb ON rr.batch_id = fb.id 
       WHERE rr.batch_id IN (${placeholders})`
    ).all(...batchIds);
  }

  const recipients = [...new Set(distributions.map(d => d.recipient_id))];

  const timeline = [];
  
  timeline.push({
    timestamp: donation.donation_date,
    type: 'donation',
    description: `捐赠登记: ${donation.quantity_ml}ml`,
    status: donation.status
  });

  tests.forEach(t => {
    timeline.push({
      timestamp: t.test_date,
      type: 'test',
      description: `${t.test_type} 检测: ${t.result}`,
      status: t.status
    });
  });

  batches.forEach(b => {
    timeline.push({
      timestamp: b.freeze_date,
      type: 'freeze',
      description: `冻存批次 ${b.batch_code}: ${b.volume_ml}ml (${b.container_count}个容器)`,
      status: b.status
    });
  });

  distributions.forEach(d => {
    timeline.push({
      timestamp: d.distribution_date,
      type: 'distribution',
      description: `发放 ${d.batch_code} 给 ${d.recipient_id}: ${d.distributed_quantity_ml}ml`,
      status: d.verification_status
    });
  });

  recalls.forEach(r => {
    timeline.push({
      timestamp: r.recall_date,
      type: 'recall',
      description: `召回 ${r.batch_code}: ${r.reason}`,
      status: r.status
    });
  });

  timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    generated_at: new Date().toISOString(),
    donation: {
      id: donation.id,
      donor_id: donation.donor_id,
      donation_date: donation.donation_date,
      quantity_ml: donation.quantity_ml,
      status: donation.status
    },
    timeline: timeline,
    summary: {
      total_tests: tests.length,
      passed_tests: tests.filter(t => t.result === 'negative').length,
      total_batches: batches.length,
      total_distributed: distributions.reduce((sum, d) => sum + d.distributed_quantity_ml, 0),
      total_recalls: recalls.length,
      unique_recipients: recipients.length,
      recipients: recipients
    }
  };
}

function generateRecipientHistoryReport(recipientId) {
  const db = getDbSync();
  
  const distributions = db.prepare(`
    SELECT dr.*, fb.batch_code, fb.donation_id, fb.status as batch_status
    FROM distribution_records dr
    JOIN frozen_batches fb ON dr.batch_id = fb.id
    WHERE dr.recipient_id = ?
    ORDER BY dr.distribution_date DESC
  `).all(recipientId);

  if (distributions.length === 0) {
    return {
      recipient_id: recipientId,
      distributions: [],
      summary: { total_received: 0, batch_count: 0, donation_count: 0 }
    };
  }

  const batchIds = [...new Set(distributions.map(d => d.batch_id))];
  const donationIds = [...new Set(distributions.map(d => d.donation_id))];

  const recalls = db.prepare(`
    SELECT rr.*, fb.batch_code
    FROM recall_records rr
    JOIN frozen_batches fb ON rr.batch_id = fb.id
    WHERE fb.id IN (${batchIds.map(() => '?').join(',')})
  `).all(...batchIds);

  const affectedBatches = recalls
    .filter(r => ['in_progress', 'partial', 'completed'].includes(r.status))
    .map(r => r.batch_code);

  return {
    generated_at: new Date().toISOString(),
    recipient_id: recipientId,
    distributions: distributions,
    recalls_affecting_this_recipient: affectedBatches,
    summary: {
      total_received_ml: distributions.reduce((sum, d) => sum + d.distributed_quantity_ml, 0),
      total_containers: distributions.reduce((sum, d) => sum + d.containers_used, 0),
      distribution_count: distributions.length,
      unique_batches: batchIds.length,
      unique_donations: donationIds.length,
      at_risk_batches: affectedBatches.length
    }
  };
}

module.exports = {
  generateInventoryReport,
  generateBatchDetailReport,
  generateDonationTraceReport,
  generateRecipientHistoryReport
};
