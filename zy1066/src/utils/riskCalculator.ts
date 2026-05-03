import { Hold, Route, WallConfig, WallZone, UserProfile, RiskAssessment, RiskLevel } from '../types';

const HOLD_SIZE_VALUES: Record<string, number> = {
  small: 15,
  medium: 25,
  large: 35,
};

const SHAPE_DIFFICULTY: Record<string, number> = {
  jug: 1,
  sloper: 2,
  edge: 3,
  pocket: 4,
  crimp: 5,
};

function calculateDistance(p1: Hold, p2: Hold): number {
  const dx = p2.position.x - p1.position.x;
  const dy = p2.position.y - p1.position.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'safe';
  if (score < 60) return 'warning';
  return 'danger';
}

function getZoneForPosition(wall: WallConfig, x: number, y: number): WallZone | null {
  for (const zone of wall.zones) {
    if (x >= zone.x && x <= zone.x + zone.width &&
        y >= zone.y && y <= zone.y + zone.height) {
      return zone;
    }
  }
  return null;
}

export function calculateRiskAssessment(
  route: Route,
  wall: WallConfig,
  userProfile: UserProfile
): RiskAssessment {
  const assessments: RiskAssessment['assessments'] = [];
  let totalRiskScore = 0;
  let assessmentCount = 0;

  const sortedHolds = [...route.holds].sort((a, b) => a.order - b.order);

  if (sortedHolds.length < 2) {
    return {
      routeId: route.id,
      overallRisk: 'safe',
      riskScore: 0,
      assessments: [{
        type: 'insufficient',
        level: 'warning',
        message: '线路岩点不足，建议至少添加2个岩点',
      }],
      heatmapData: [],
    };
  }

  const startHold = sortedHolds.find(h => h.isStart);
  const endHold = sortedHolds.find(h => h.isEnd);

  if (!startHold) {
    assessments.push({
      type: 'missing_start',
      level: 'warning',
      message: '线路缺少起点标记',
    });
    totalRiskScore += 20;
    assessmentCount++;
  }

  if (!endHold) {
    assessments.push({
      type: 'missing_end',
      level: 'warning',
      message: '线路缺少终点标记',
    });
    totalRiskScore += 20;
    assessmentCount++;
  }

  for (let i = 0; i < sortedHolds.length - 1; i++) {
    const hold1 = sortedHolds[i];
    const hold2 = sortedHolds[i + 1];
    const distance = calculateDistance(hold1, hold2);
    const reachLimit = userProfile.armSpan * 0.8;

    if (distance > reachLimit * 1.2) {
      assessments.push({
        type: 'reach_distance',
        level: 'danger',
        message: `岩点 #${hold1.order + 1} 到 #${hold2.order + 1} 距离太远 (${Math.round(distance)}cm)`,
        details: `建议最大臂展范围: ${Math.round(reachLimit)}cm`,
        affectedHolds: [hold1.id, hold2.id],
      });
      totalRiskScore += 80;
      assessmentCount++;
    } else if (distance > reachLimit) {
      assessments.push({
        type: 'reach_distance',
        level: 'warning',
        message: `岩点 #${hold1.order + 1} 到 #${hold2.order + 1} 距离偏长 (${Math.round(distance)}cm)`,
        details: `建议最大臂展范围: ${Math.round(reachLimit)}cm`,
        affectedHolds: [hold1.id, hold2.id],
      });
      totalRiskScore += 40;
      assessmentCount++;
    }
  }

  const heightRatio = wall.height / 100;
  for (const hold of sortedHolds) {
    const normalizedHeight = hold.position.y / heightRatio;
    const relativeHeight = normalizedHeight / userProfile.height;

    if (relativeHeight > 1.8) {
      assessments.push({
        type: 'height_risk',
        level: 'danger',
        message: `岩点 #${hold.order + 1} 位置过高，落点风险大`,
        details: `高度: ${Math.round(normalizedHeight)}cm`,
        affectedHolds: [hold.id],
      });
      totalRiskScore += 70;
      assessmentCount++;
    } else if (relativeHeight > 1.5) {
      assessments.push({
        type: 'height_risk',
        level: 'warning',
        message: `岩点 #${hold.order + 1} 位置偏高，注意落点保护`,
        details: `高度: ${Math.round(normalizedHeight)}cm`,
        affectedHolds: [hold.id],
      });
      totalRiskScore += 35;
      assessmentCount++;
    }
  }

  let horizontalSpanRisk = 0;
  for (let i = 0; i < sortedHolds.length - 1; i++) {
    const hold1 = sortedHolds[i];
    const hold2 = sortedHolds[i + 1];
    const horizontalDist = Math.abs(hold2.position.x - hold1.position.x);

    if (horizontalDist > userProfile.armSpan * 0.6) {
      horizontalSpanRisk = Math.max(horizontalSpanRisk, 50);
      if (horizontalDist > userProfile.armSpan * 0.8) {
        horizontalSpanRisk = Math.max(horizontalSpanRisk, 80);
      }
    }
  }

  if (horizontalSpanRisk > 0) {
    assessments.push({
      type: 'horizontal_span',
      level: horizontalSpanRisk >= 70 ? 'danger' : 'warning',
      message: horizontalSpanRisk >= 70 
        ? '横向跨度过大，可能需要动态动作' 
        : '横向跨度偏长，对平衡要求较高',
    });
    totalRiskScore += horizontalSpanRisk;
    assessmentCount++;
  }

  for (const hold of sortedHolds) {
    const zone = getZoneForPosition(wall, hold.position.x, hold.position.y);
    if (zone && zone.riskMultiplier > 1.2) {
      assessments.push({
        type: 'zone_risk',
        level: zone.riskMultiplier > 1.5 ? 'danger' : 'warning',
        message: `岩点 #${hold.order + 1} 位于高风险区域: ${zone.name}`,
        affectedHolds: [hold.id],
      });
      totalRiskScore += 30 * zone.riskMultiplier;
      assessmentCount++;
    }
  }

  let shapeDifficulty = 0;
  for (const hold of sortedHolds) {
    shapeDifficulty += SHAPE_DIFFICULTY[hold.shape] || 1;
  }
  const avgShapeDifficulty = shapeDifficulty / sortedHolds.length;

  if (avgShapeDifficulty > 4 && route.difficulty === 'beginner') {
    assessments.push({
      type: 'difficulty_mismatch',
      level: 'warning',
      message: '初级线路使用了较多难点型岩点，难度可能偏高',
      details: `平均难度系数: ${avgShapeDifficulty.toFixed(1)}/5`,
    });
    totalRiskScore += 25;
    assessmentCount++;
  }

  const densityCheck = new Map<string, number>();
  const gridSize = 50;
  for (const hold of sortedHolds) {
    const gridX = Math.floor(hold.position.x / gridSize);
    const gridY = Math.floor(hold.position.y / gridSize);
    const key = `${gridX},${gridY}`;
    densityCheck.set(key, (densityCheck.get(key) || 0) + 1);
  }

  for (const [key, count] of densityCheck) {
    if (count >= 3) {
      const [gx, gy] = key.split(',').map(Number);
      const nearbyHolds = sortedHolds.filter(h => {
        const hx = Math.floor(h.position.x / gridSize);
        const hy = Math.floor(h.position.y / gridSize);
        return Math.abs(hx - gx) <= 1 && Math.abs(hy - gy) <= 1;
      });
      assessments.push({
        type: 'density',
        level: 'warning',
        message: count >= 4 ? '局部区域岩点过密，可能造成线路干扰' : '局部区域岩点较集中',
        affectedHolds: nearbyHolds.map(h => h.id),
      });
      totalRiskScore += count * 10;
      assessmentCount++;
    }
  }

  if (assessments.length === 0) {
    assessments.push({
      type: 'overall',
      level: 'safe',
      message: '线路设计合理，未发现明显风险点',
    });
  }

  const avgRiskScore = assessmentCount > 0 ? totalRiskScore / assessmentCount : 0;
  const overallRisk = getRiskLevel(avgRiskScore);

  const heatmapData = generateHeatmapData(route, wall, userProfile);

  return {
    routeId: route.id,
    overallRisk,
    riskScore: Math.min(100, Math.round(avgRiskScore)),
    assessments,
    heatmapData,
  };
}

function generateHeatmapData(
  route: Route,
  wall: WallConfig,
  _userProfile: UserProfile
) {
  const cells = [];
  const cellSize = 40;
  const cols = Math.ceil(wall.width / cellSize);
  const rows = Math.ceil(wall.height / cellSize);

  const densityGrid = new Map<string, number>();
  for (const hold of route.holds) {
    const gridX = Math.floor(hold.position.x / cellSize);
    const gridY = Math.floor(hold.position.y / cellSize);
    const radius = 2;
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const gx = gridX + dx;
          const gy = gridY + dy;
          if (gx >= 0 && gy >= 0) {
            const key = `${gx},${gy}`;
            const intensity = 1 - (dist / (radius + 1));
            densityGrid.set(key, (densityGrid.get(key) || 0) + intensity);
          }
        }
      }
    }
  }

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const key = `${x},${y}`;
      const density = densityGrid.get(key) || 0;
      
      if (density > 0) {
        const normalizedY = y / rows;
        const heightFactor = normalizedY;
        
        const totalIntensity = Math.min(1, (density * 0.3) + (heightFactor * 0.4));
        
        cells.push({
          x: x * cellSize,
          y: y * cellSize,
          intensity: totalIntensity,
          category: 'density' as const,
        });
      }
    }
  }

  return cells;
}

export function calculateOverallRisk(
  routes: Route[],
  wall: WallConfig,
  userProfile: UserProfile
) {
  const assessments = routes.map(r => calculateRiskAssessment(r, wall, userProfile));
  
  const byRisk: Record<string, number> = { safe: 0, warning: 0, danger: 0 };
  let totalScore = 0;
  
  for (const a of assessments) {
    byRisk[a.overallRisk]++;
    totalScore += a.riskScore;
  }
  
  return {
    byRisk,
    avgRiskScore: routes.length > 0 ? Math.round(totalScore / routes.length) : 0,
    assessments,
  };
}
