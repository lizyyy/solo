const { getDatabase, saveDatabase } = require('../database');

const RISK_LEVELS = {
  NORMAL: 'normal',
  CAUTION: 'caution',
  WARNING: 'warning',
  CRITICAL: 'critical',
  SCRAP: 'scrap'
};

function calculateRiskLevel(value, threshold, thresholds) {
  if (!threshold) return RISK_LEVELS.NORMAL;
  
  const ratio = value / threshold;
  
  if (ratio >= (thresholds.scrap || 1.0)) return RISK_LEVELS.SCRAP;
  if (ratio >= (thresholds.critical || 0.9)) return RISK_LEVELS.CRITICAL;
  if (ratio >= (thresholds.warning || 0.75)) return RISK_LEVELS.WARNING;
  if (ratio >= (thresholds.caution || 0.5)) return RISK_LEVELS.CAUTION;
  return RISK_LEVELS.NORMAL;
}

function getOverallRiskLevel(risks) {
  const priority = [
    RISK_LEVELS.SCRAP,
    RISK_LEVELS.CRITICAL,
    RISK_LEVELS.WARNING,
    RISK_LEVELS.CAUTION,
    RISK_LEVELS.NORMAL
  ];
  
  for (const level of priority) {
    if (risks.includes(level)) {
      return level;
    }
  }
  return RISK_LEVELS.NORMAL;
}

function getRiskWeight(level) {
  const weights = {
    [RISK_LEVELS.NORMAL]: 0,
    [RISK_LEVELS.CAUTION]: 1,
    [RISK_LEVELS.WARNING]: 2,
    [RISK_LEVELS.CRITICAL]: 3,
    [RISK_LEVELS.SCRAP]: 4
  };
  return weights[level] || 0;
}

function getRiskColor(level) {
  const colors = {
    [RISK_LEVELS.NORMAL]: '#10b981',
    [RISK_LEVELS.CAUTION]: '#f59e0b',
    [RISK_LEVELS.WARNING]: '#ef4444',
    [RISK_LEVELS.CRITICAL]: '#dc2626',
    [RISK_LEVELS.SCRAP]: '#7f1d1d'
  };
  return colors[level] || '#10b981';
}

function getRiskLabel(level) {
  const labels = {
    [RISK_LEVELS.NORMAL]: '正常',
    [RISK_LEVELS.CAUTION]: '注意',
    [RISK_LEVELS.WARNING]: '警告',
    [RISK_LEVELS.CRITICAL]: '严重',
    [RISK_LEVELS.SCRAP]: '报废'
  };
  return labels[level] || '正常';
}

function calculateTotalEnergy(ropeId, db) {
  const result = db.exec(`
    SELECT COALESCE(SUM(fall_energy_kj), 0) as total_energy
    FROM usage_records
    WHERE rope_id = ?
  `, [ropeId]);
  
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0];
  }
  return 0;
}

function calculateServiceDays(rope, db) {
  if (!rope.purchase_date) {
    const result = db.exec(`
      SELECT MIN(usage_date) as first_date
      FROM usage_records
      WHERE rope_id = ?
    `, [rope.id]);
    
    if (result.length > 0 && result[0].values.length > 0 && result[0].values[0][0]) {
      const firstDate = new Date(result[0].values[0][0]);
      const today = new Date();
      return Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));
    }
    return 0;
  }
  
  const purchaseDate = new Date(rope.purchase_date);
  const today = new Date();
  return Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));
}

function getCurrentWearLevel(rope, db) {
  const result = db.exec(`
    SELECT wear_level
    FROM usage_records
    WHERE rope_id = ? AND wear_level IS NOT NULL
    ORDER BY usage_date DESC, id DESC
    LIMIT 1
  `, [rope.id]);
  
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0];
  }
  return rope.wear_level || 0;
}

function getDailyOverloads(ropeId, threshold, db) {
  const maxDailyUses = threshold?.max_daily_uses || 10;
  const maxDailyEnergy = threshold?.max_daily_energy_kj || 50;
  
  const result = db.exec(`
    SELECT usage_date,
           SUM(uses_count) as daily_uses,
           SUM(fall_energy_kj) as daily_energy
    FROM usage_records
    WHERE rope_id = ?
    GROUP BY usage_date
    HAVING daily_uses > ? OR daily_energy > ?
    ORDER BY usage_date DESC
  `, [ropeId, maxDailyUses, maxDailyEnergy]);
  
  const overloads = [];
  if (result.length > 0) {
    for (const row of result[0].values) {
      overloads.push({
        date: row[0],
        uses: row[1],
        energy: row[2],
        uses_overload: row[1] > maxDailyUses,
        energy_overload: row[2] > maxDailyEnergy
      });
    }
  }
  
  return {
    count: overloads.length,
    recent: overloads.slice(0, 10),
    maxDailyUses,
    maxDailyEnergy
  };
}

function getManufacturerThreshold(rope, db) {
  if (!rope.brand || !rope.model) {
    return null;
  }
  
  const result = db.exec(`
    SELECT * FROM manufacturer_thresholds
    WHERE brand = ? AND model = ?
    LIMIT 1
  `, [rope.brand, rope.model]);
  
  if (result.length > 0 && result[0].values.length > 0) {
    const row = result[0].values[0];
    const columns = result[0].columns;
    const threshold = {};
    columns.forEach((col, index) => {
      threshold[col] = row[index];
    });
    return threshold;
  }
  
  const defaultResult = db.exec(`
    SELECT * FROM manufacturer_thresholds
    WHERE brand = 'DEFAULT'
    LIMIT 1
  `);
  
  if (defaultResult.length > 0 && defaultResult[0].values.length > 0) {
    const row = defaultResult[0].values[0];
    const columns = defaultResult[0].columns;
    const threshold = {};
    columns.forEach((col, index) => {
      threshold[col] = row[index];
    });
    return threshold;
  }
  
  return {
    max_total_energy_kj: 100,
    max_service_days: 365,
    max_wear_level: 5,
    max_daily_uses: 10,
    max_daily_energy_kj: 50
  };
}

function assessRopeRisk(ropeId) {
  const db = getDatabase();
  
  const ropeResult = db.exec(`
    SELECT * FROM ropes WHERE id = ?
  `, [ropeId]);
  
  if (ropeResult.length === 0 || ropeResult[0].values.length === 0) {
    return null;
  }
  
  const columns = ropeResult[0].columns;
  const row = ropeResult[0].values[0];
  const rope = {};
  columns.forEach((col, index) => {
    rope[col] = row[index];
  });
  
  const threshold = getManufacturerThreshold(rope, db);
  
  const totalEnergy = calculateTotalEnergy(ropeId, db);
  const serviceDays = calculateServiceDays(rope, db);
  const currentWearLevel = getCurrentWearLevel(rope, db);
  const dailyOverloads = getDailyOverloads(ropeId, threshold, db);
  
  const riskThresholds = {
    scrap: 1.0,
    critical: 0.9,
    warning: 0.75,
    caution: 0.5
  };
  
  const energyRisk = threshold ? 
    calculateRiskLevel(totalEnergy, threshold.max_total_energy_kj, riskThresholds) :
    RISK_LEVELS.NORMAL;
  
  const daysRisk = threshold ?
    calculateRiskLevel(serviceDays, threshold.max_service_days, riskThresholds) :
    RISK_LEVELS.NORMAL;
  
  const wearRisk = threshold ?
    calculateRiskLevel(currentWearLevel, threshold.max_wear_level, riskThresholds) :
    RISK_LEVELS.NORMAL;
  
  let dailyOverloadRisk = RISK_LEVELS.NORMAL;
  if (dailyOverloads.count > 0) {
    if (dailyOverloads.count >= 5) {
      dailyOverloadRisk = RISK_LEVELS.CRITICAL;
    } else if (dailyOverloads.count >= 3) {
      dailyOverloadRisk = RISK_LEVELS.WARNING;
    } else {
      dailyOverloadRisk = RISK_LEVELS.CAUTION;
    }
  }
  
  const overallRisk = getOverallRiskLevel([
    energyRisk,
    daysRisk,
    wearRisk,
    dailyOverloadRisk
  ]);
  
  const riskFactors = [];
  
  if (getRiskWeight(energyRisk) > 0) {
    riskFactors.push({
      type: 'energy',
      level: energyRisk,
      label: '累计冲坠能量',
      value: totalEnergy.toFixed(2),
      threshold: threshold?.max_total_energy_kj,
      unit: 'kJ'
    });
  }
  
  if (getRiskWeight(daysRisk) > 0) {
    riskFactors.push({
      type: 'days',
      level: daysRisk,
      label: '使用天数',
      value: serviceDays,
      threshold: threshold?.max_service_days,
      unit: '天'
    });
  }
  
  if (getRiskWeight(wearRisk) > 0) {
    riskFactors.push({
      type: 'wear',
      level: wearRisk,
      label: '磨损等级',
      value: currentWearLevel,
      threshold: threshold?.max_wear_level,
      unit: '级'
    });
  }
  
  if (getRiskWeight(dailyOverloadRisk) > 0) {
    riskFactors.push({
      type: 'daily_overload',
      level: dailyOverloadRisk,
      label: '同日超负荷',
      value: dailyOverloads.count,
      threshold: 0,
      unit: '次'
    });
  }
  
  const assessment = {
    rope_id: ropeId,
    assessment_date: new Date().toISOString().split('T')[0],
    total_energy_kj: totalEnergy,
    service_days: serviceDays,
    current_wear_level: currentWearLevel,
    max_daily_uses: dailyOverloads.maxDailyUses,
    max_daily_energy_kj: dailyOverloads.maxDailyEnergy,
    energy_risk_level: energyRisk,
    days_risk_level: daysRisk,
    wear_risk_level: wearRisk,
    daily_overload_risk_level: dailyOverloadRisk,
    overall_risk_level: overallRisk,
    risk_factors: JSON.stringify(riskFactors),
    rope_info: {
      rope_number: rope.rope_number,
      brand: rope.brand,
      model: rope.model
    },
    daily_overloads: dailyOverloads,
    threshold: threshold
  };
  
  db.run(`
    INSERT INTO risk_assessments (
      rope_id, assessment_date, total_energy_kj, service_days,
      current_wear_level, max_daily_uses, max_daily_energy_kj,
      energy_risk_level, days_risk_level, wear_risk_level,
      daily_overload_risk_level, overall_risk_level, risk_factors
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    assessment.rope_id,
    assessment.assessment_date,
    assessment.total_energy_kj,
    assessment.service_days,
    assessment.current_wear_level,
    assessment.max_daily_uses,
    assessment.max_daily_energy_kj,
    assessment.energy_risk_level,
    assessment.days_risk_level,
    assessment.wear_risk_level,
    assessment.daily_overload_risk_level,
    assessment.overall_risk_level,
    assessment.risk_factors
  ]);
  
  saveDatabase();
  
  return assessment;
}

function getRopeTimeline(ropeId) {
  const db = getDatabase();
  
  const assessmentsResult = db.exec(`
    SELECT ra.*, r.rope_number, r.brand, r.model
    FROM risk_assessments ra
    JOIN ropes r ON ra.rope_id = r.id
    WHERE ra.rope_id = ?
    ORDER BY ra.assessment_date DESC
  `, [ropeId]);
  
  const timeline = [];
  
  if (assessmentsResult.length > 0) {
    const columns = assessmentsResult[0].columns;
    for (const row of assessmentsResult[0].values) {
      const item = {};
      columns.forEach((col, index) => {
        item[col] = row[index];
      });
      
      if (item.risk_factors) {
        try {
          item.risk_factors = JSON.parse(item.risk_factors);
        } catch (e) {
          item.risk_factors = [];
        }
      }
      
      const reviewResult = db.exec(`
        SELECT * FROM review_decisions
        WHERE risk_assessment_id = ?
        ORDER BY review_date DESC
        LIMIT 1
      `, [item.id]);
      
      if (reviewResult.length > 0 && reviewResult[0].values.length > 0) {
        const reviewColumns = reviewResult[0].columns;
        const reviewRow = reviewResult[0].values[0];
        item.review_decision = {};
        reviewColumns.forEach((col, index) => {
          item.review_decision[col] = reviewRow[index];
        });
        item.effective_risk_level = item.review_decision.new_risk_level;
      } else {
        item.effective_risk_level = item.overall_risk_level;
      }
      
      timeline.push(item);
    }
  }
  
  return timeline;
}

function getAllRopesWithRisk() {
  const db = getDatabase();
  
  const ropesResult = db.exec(`
    SELECT * FROM ropes
    ORDER BY rope_number
  `);
  
  const ropes = [];
  
  if (ropesResult.length > 0) {
    const columns = ropesResult[0].columns;
    for (const row of ropesResult[0].values) {
      const rope = {};
      columns.forEach((col, index) => {
        rope[col] = row[index];
      });
      
      const latestAssessment = db.exec(`
        SELECT * FROM risk_assessments
        WHERE rope_id = ?
        ORDER BY assessment_date DESC
        LIMIT 1
      `, [rope.id]);
      
      if (latestAssessment.length > 0 && latestAssessment[0].values.length > 0) {
        const assessmentColumns = latestAssessment[0].columns;
        const assessmentRow = latestAssessment[0].values[0];
        rope.latest_assessment = {};
        assessmentColumns.forEach((col, index) => {
          rope.latest_assessment[col] = assessmentRow[index];
        });
        
        if (rope.latest_assessment.risk_factors) {
          try {
            rope.latest_assessment.risk_factors = JSON.parse(rope.latest_assessment.risk_factors);
          } catch (e) {
            rope.latest_assessment.risk_factors = [];
          }
        }
        
        const reviewResult = db.exec(`
          SELECT * FROM review_decisions
          WHERE risk_assessment_id = ?
          ORDER BY review_date DESC
          LIMIT 1
        `, [rope.latest_assessment.id]);
        
        if (reviewResult.length > 0 && reviewResult[0].values.length > 0) {
          const reviewColumns = reviewResult[0].columns;
          const reviewRow = reviewResult[0].values[0];
          rope.latest_assessment.review_decision = {};
          reviewColumns.forEach((col, index) => {
            rope.latest_assessment.review_decision[col] = reviewRow[index];
          });
          rope.latest_assessment.effective_risk_level = rope.latest_assessment.review_decision.new_risk_level;
        } else {
          rope.latest_assessment.effective_risk_level = rope.latest_assessment.overall_risk_level;
        }
      }
      
      ropes.push(rope);
    }
  }
  
  return ropes;
}

function createReviewDecision(assessmentId, newRiskLevel, decisionType, reviewerName, reviewNotes, isScrapped = false) {
  const db = getDatabase();
  
  const assessmentResult = db.exec(`
    SELECT * FROM risk_assessments WHERE id = ?
  `, [assessmentId]);
  
  if (assessmentResult.length === 0 || assessmentResult[0].values.length === 0) {
    return null;
  }
  
  const assessmentColumns = assessmentResult[0].columns;
  const assessmentRow = assessmentResult[0].values[0];
  const assessment = {};
  assessmentColumns.forEach((col, index) => {
    assessment[col] = assessmentRow[index];
  });
  
  const originalRiskLevel = assessment.overall_risk_level;
  
  db.run(`
    INSERT INTO review_decisions (
      risk_assessment_id, original_risk_level, new_risk_level,
      decision_type, reviewer_name, review_notes, is_scrapped
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    assessmentId,
    originalRiskLevel,
    newRiskLevel,
    decisionType,
    reviewerName,
    reviewNotes,
    isScrapped ? 1 : 0
  ]);
  
  if (isScrapped) {
    db.run(`
      UPDATE ropes
      SET status = 'scrapped'
      WHERE id = ?
    `, [assessment.rope_id]);
    
    db.run(`
      INSERT INTO scrap_decisions (
        rope_id, decision_date, reason, risk_factors_at_scrap,
        reviewer_name, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      assessment.rope_id,
      new Date().toISOString().split('T')[0],
      decisionType === 'scrap' ? '人工判定报废' : decisionType,
      assessment.risk_factors,
      reviewerName,
      reviewNotes
    ]);
  }
  
  saveDatabase();
  
  return {
    assessment_id: assessmentId,
    original_risk_level: originalRiskLevel,
    new_risk_level: newRiskLevel,
    decision_type: decisionType,
    is_scrapped: isScrapped
  };
}

module.exports = {
  RISK_LEVELS,
  calculateRiskLevel,
  getOverallRiskLevel,
  getRiskWeight,
  getRiskColor,
  getRiskLabel,
  assessRopeRisk,
  getRopeTimeline,
  getAllRopesWithRisk,
  createReviewDecision,
  getManufacturerThreshold,
  calculateTotalEnergy,
  calculateServiceDays,
  getCurrentWearLevel,
  getDailyOverloads
};
