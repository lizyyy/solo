const { isInTimeSlot } = require('./utils');

function analyzeDecibelRecords(records, rules) {
  if (!records || records.length === 0) {
    return {
      hasEvidence: false,
      continuousViolations: [],
      maxDb: 0,
      avgDb: 0,
      totalViolationSeconds: 0,
      triggeredRules: []
    };
  }

  const sorted = [...records].sort((a, b) => 
    new Date(a.record_time) - new Date(b.record_time)
  );

  let maxDb = 0;
  let totalDb = 0;
  let totalViolationSeconds = 0;
  const continuousViolations = [];

  sorted.forEach(r => {
    if (r.db_value > maxDb) maxDb = r.db_value;
    totalDb += r.db_value;
  });

  const avgDb = totalDb / sorted.length;

  const activeRules = rules
    .filter(r => r.is_active === 1)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of activeRules) {
    const relevantRecords = sorted.filter(r => 
      r.db_value >= rule.db_threshold &&
      isInTimeSlot(r.record_time, rule.time_slot_start, rule.time_slot_end)
    );

    if (relevantRecords.length === 0) continue;

    let currentBlock = [];
    let currentStart = null;
    let blockMaxDb = 0;
    let blockTotalSeconds = 0;

    for (let i = 0; i < relevantRecords.length; i++) {
      const rec = relevantRecords[i];
      const prevRec = i > 0 ? relevantRecords[i - 1] : null;

      const gapMinutes = prevRec 
        ? (new Date(rec.record_time) - new Date(prevRec.record_time)) / 60000
        : 0;

      if (!prevRec || gapMinutes > 10) {
        if (currentBlock.length > 0) {
          if (blockTotalSeconds >= rule.duration_threshold_seconds) {
            continuousViolations.push({
              rule_id: rule.id,
              rule_name: rule.rule_name,
              start_time: currentStart,
              end_time: prevRec.record_time,
              duration_seconds: blockTotalSeconds,
              max_db: blockMaxDb,
              threshold_db: rule.db_threshold
            });
            totalViolationSeconds += blockTotalSeconds;
          }
        }
        currentBlock = [rec];
        currentStart = rec.record_time;
        blockMaxDb = rec.db_value;
        blockTotalSeconds = rec.duration_seconds || 60;
      } else {
        currentBlock.push(rec);
        blockTotalSeconds += rec.duration_seconds || 60;
        if (rec.db_value > blockMaxDb) blockMaxDb = rec.db_value;
      }
    }

    if (currentBlock.length > 0) {
      if (blockTotalSeconds >= rule.duration_threshold_seconds) {
        const lastRec = relevantRecords[relevantRecords.length - 1];
        continuousViolations.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          start_time: currentStart,
          end_time: lastRec.record_time,
          duration_seconds: blockTotalSeconds,
          max_db: blockMaxDb,
          threshold_db: rule.db_threshold
        });
        totalViolationSeconds += blockTotalSeconds;
      }
    }
  }

  const uniqueRuleIds = [...new Set(continuousViolations.map(v => v.rule_id))];
  const triggeredRules = activeRules.filter(r => uniqueRuleIds.includes(r.id));

  return {
    hasEvidence: continuousViolations.length > 0,
    continuousViolations,
    maxDb,
    avgDb,
    totalViolationSeconds,
    triggeredRules
  };
}

function calculateCompensation(analysis, order, rules) {
  if (!analysis.hasEvidence || !order) {
    return {
      eligible: false,
      amount: 0,
      reason: '无有效噪音证据',
      appliedRule: null
    };
  }

  const violation = analysis.continuousViolations[0];
  const rule = rules.find(r => r.id === violation.rule_id);

  if (!rule) {
    return {
      eligible: false,
      amount: 0,
      reason: '未匹配到赔付规则',
      appliedRule: null
    };
  }

  let amount = 0;
  let reason = '';

  if (rule.compensation_type === 'percent') {
    amount = Math.round((order.total_amount * rule.compensation_value / 100) * 100) / 100;
    reason = `按订单金额的${rule.compensation_value}%赔付`;
  } else if (rule.compensation_type === 'fixed') {
    amount = rule.compensation_value;
    reason = `按固定金额${rule.compensation_value}元赔付`;
  }

  return {
    eligible: true,
    amount,
    reason,
    appliedRule: rule,
    violationDetails: violation
  };
}

function evaluateEvidenceQuality(segments) {
  if (!segments || segments.length === 0) {
    return { score: 0, level: 'none', issues: ['无证据片段'] };
  }

  let score = 0;
  const issues = [];

  const verifiedCount = segments.filter(s => s.is_verified === 1).length;
  const totalCount = segments.length;
  const verifiedRatio = verifiedCount / totalCount;

  if (verifiedCount === 0) {
    issues.push('证据片段未经过验证');
  }

  if (verifiedRatio >= 1) {
    score += 40;
  } else if (verifiedRatio >= 0.5) {
    score += 25;
  } else if (verifiedRatio > 0) {
    score += 10;
  }

  const hasAudio = segments.some(s => s.segment_type === 'audio' || s.segment_type === 'video');
  const hasDecibel = segments.some(s => s.segment_type === 'decibel' || s.db_avg !== null);
  const hasNeighbor = segments.some(s => s.segment_type === 'neighbor_feedback');

  if (hasAudio) score += 20;
  if (hasDecibel) score += 25;
  if (hasNeighbor) score += 15;

  if (!hasDecibel) {
    issues.push('缺少分贝数据证据');
  }
  if (!hasAudio && totalCount < 3) {
    issues.push('证据片段数量不足');
  }

  let level = 'poor';
  if (score >= 80) level = 'excellent';
  else if (score >= 60) level = 'good';
  else if (score >= 40) level = 'fair';

  return { score, level, issues };
}

function requiresReview(analysis, evidenceQuality, complaint) {
  const reasons = [];

  if (evidenceQuality.level === 'poor') {
    reasons.push('证据质量较差');
  }

  if (evidenceQuality.issues && evidenceQuality.issues.length > 0) {
    reasons.push(...evidenceQuality.issues);
  }

  if (!analysis.hasEvidence) {
    reasons.push('无有效噪音数据证据');
  }

  if (complaint && complaint.reporter_type === 'neighbor' && !analysis.hasEvidence) {
    reasons.push('邻居投诉但缺少噪音验证数据');
  }

  if (analysis.continuousViolations.length > 3) {
    reasons.push('多段违规噪音，需人工确认');
  }

  if (analysis.maxDb >= 90) {
    reasons.push('噪音峰值过高(≥90dB)，需人工复核');
  }

  return {
    required: reasons.length > 0,
    reasons
  };
}

module.exports = {
  analyzeDecibelRecords,
  calculateCompensation,
  evaluateEvidenceQuality,
  requiresReview
};
