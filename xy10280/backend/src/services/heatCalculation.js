function calculateDifferenceRate(registrationCount, actualCount) {
  if (registrationCount === 0) return 0;
  return (registrationCount - actualCount) / registrationCount;
}

function calculateHeatScore(differenceRate, registrationCount) {
  let baseScore = 100;
  
  baseScore -= differenceRate * 100;
  
  if (registrationCount < 3) baseScore -= 10;
  else if (registrationCount < 5) baseScore -= 5;
  
  return Math.max(0, Math.min(100, baseScore));
}

function getHeatLevel(heatScore) {
  if (heatScore >= 70) return 'high';
  if (heatScore >= 40) return 'medium';
  return 'low';
}

function checkInterceptionRules(data) {
  const { registration_count, actual_count, difference_rate, heat_score } = data;
  const warnings = [];
  let needsReview = false;
  
  if (registration_count === 0) {
    warnings.push({
      type: 'info',
      message: '该站点无活跃报名记录'
    });
  }
  
  if (registration_count >= 10) {
    warnings.push({
      type: 'block',
      message: `报名人数${registration_count}人≥10人，撤点需经过部门主管复核`,
      review_level: 'department'
    });
    needsReview = true;
  }
  
  if (difference_rate >= 0.7 && registration_count >= 5) {
    warnings.push({
      type: 'warning',
      message: `差异率${(difference_rate * 100).toFixed(1)}%≥70%，建议核实数据准确性`,
      review_level: 'operations'
    });
    needsReview = true;
  }
  
  if (actual_count === 0 && registration_count >= 3) {
    warnings.push({
      type: 'warning',
      message: '实际乘车为0但有报名记录，需确认刷卡设备是否正常',
      review_level: 'technical'
    });
    needsReview = true;
  }
  
  if (heat_score >= 80 && registration_count >= 5) {
    warnings.push({
      type: 'info',
      message: '站点热度较高，建议维持运营',
      review_level: 'none'
    });
  }
  
  return {
    needsReview,
    warnings,
    review_level: warnings.filter(w => w.type === 'block').length > 0 ? 'department' : 
                  warnings.filter(w => w.type === 'warning').length > 0 ? 'operations' : 'none'
  };
}

module.exports = {
  calculateDifferenceRate,
  calculateHeatScore,
  getHeatLevel,
  checkInterceptionRules
};
