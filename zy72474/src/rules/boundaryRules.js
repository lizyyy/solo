const { BOUNDARY_STATUS } = require('../data/models');

const BOUNDARY_RULES = {
  RULE_001: {
    id: 'RULE_001',
    name: '多街道归属判定',
    description: '点位关联2个或以上街道时，自动标记为边界待复核',
    condition: (point) => point.streets && point.streets.length > 1,
    action: (point) => {
      point.boundaryStatus = BOUNDARY_STATUS.BOUNDARY_PENDING;
      return {
        ruleApplied: 'RULE_001',
        message: `点位[${point.name}]关联${point.streets.length}个街道，标记为待复核`,
        needsReview: true
      };
    }
  },
  RULE_002: {
    id: 'RULE_002',
    name: '经纬度边界距离判定',
    description: '根据经纬度计算点位与街道边界线的距离，小于阈值则标记为边界',
    condition: (point, context) => {
      if (!context || !context.boundaryLines) return false;
      return point.lat && point.lng;
    },
    action: (point, context) => {
      const threshold = context.threshold || 0.0001;
      let nearBoundary = false;
      let matchedStreets = [];
      
      for (const line of context.boundaryLines) {
        const dist = calculatePointToLineDistance(
          point.lat, point.lng,
          line.start.lat, line.start.lng,
          line.end.lat, line.end.lng
        );
        if (dist < threshold) {
          nearBoundary = true;
          matchedStreets = matchedStreets.concat(line.streets || []);
        }
      }
      
      if (nearBoundary) {
        const newStreets = [...new Set([...point.streets, ...matchedStreets])];
        point.streets = newStreets;
        point.boundaryStatus = BOUNDARY_STATUS.BOUNDARY_PENDING;
        return {
          ruleApplied: 'RULE_002',
          message: `点位[${point.name}]距离街道边界${threshold}以内，标记为待复核`,
          needsReview: true,
          matchedStreets
        };
      }
      
      return { ruleApplied: 'RULE_002', message: '点位不在边界范围内', needsReview: false };
    }
  },
  RULE_003: {
    id: 'RULE_003',
    name: '单街道自动确认',
    description: '点位仅关联1个街道且无边界标记时，确认为正常点位',
    condition: (point) => point.streets && point.streets.length === 1,
    action: (point) => {
      point.boundaryStatus = BOUNDARY_STATUS.NORMAL;
      point.assignedStreet = point.streets[0];
      return {
        ruleApplied: 'RULE_003',
        message: `点位[${point.name}]归属街道[${point.streets[0]}]已确认`,
        needsReview: false
      };
    }
  },
  RULE_004: {
    id: 'RULE_004',
    name: '项目经理复核确认',
    description: '项目经理人工确认边界点位的街道归属',
    condition: (point, context) => context && context.reviewAction === 'confirm',
    action: (point, context) => {
      const previous = JSON.parse(JSON.stringify(point));
      point.boundaryStatus = BOUNDARY_STATUS.BOUNDARY_CONFIRMED;
      point.assignedStreet = context.assignedStreet;
      return {
        ruleApplied: 'RULE_004',
        message: `点位[${point.name}]已由${context.reviewedBy || '项目经理'}确认归属[${context.assignedStreet}]`,
        needsReview: false,
        previous,
        reviewedBy: context.reviewedBy
      };
    }
  },
  RULE_005: {
    id: 'RULE_005',
    name: '边界点位回滚',
    description: '将已确认的边界点位回滚到待复核状态',
    condition: (point, context) => context && context.reviewAction === 'rollback',
    action: (point, context) => {
      const previous = JSON.parse(JSON.stringify(point));
      point.boundaryStatus = BOUNDARY_STATUS.BOUNDARY_PENDING;
      point.assignedStreet = null;
      return {
        ruleApplied: 'RULE_005',
        message: `点位[${point.name}]已由${context.reviewedBy || '项目经理'}回滚到待复核状态`,
        needsReview: true,
        previous,
        rolledBackBy: context.reviewedBy
      };
    }
  }
};

function calculatePointToLineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;
  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function applyBoundaryRules(point, context = {}) {
  const results = [];
  let needsReview = false;
  
  for (const ruleKey of Object.keys(BOUNDARY_RULES)) {
    const rule = BOUNDARY_RULES[ruleKey];
    try {
      if (rule.condition(point, context)) {
        const result = rule.action(point, context);
        results.push(result);
        if (result.needsReview) needsReview = true;
      }
    } catch (e) {
      results.push({
        ruleApplied: rule.id,
        message: `规则执行出错: ${e.message}`,
        error: true
      });
    }
  }
  
  return { point, results, needsReview };
}

function getAllRules() {
  return Object.values(BOUNDARY_RULES).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description
  }));
}

module.exports = {
  BOUNDARY_RULES,
  applyBoundaryRules,
  getAllRules,
  calculatePointToLineDistance
};
