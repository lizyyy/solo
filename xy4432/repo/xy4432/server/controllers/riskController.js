const { dataStore, saveData, generateId } = require('../data/store');

const RISK_TYPES = {
  OVERCROWDING: {
    id: 'overcrowding',
    name: '路线拥挤',
    description: '多个路线在同一区域过于密集，可能导致攀爬者相互干扰',
    severity: 'medium'
  },
  LARGE_SPAN: {
    id: 'large_span',
    name: '跨距过大',
    description: '相邻岩点之间的距离超过合理范围，可能导致动作困难或受伤',
    severity: 'high'
  },
  KIDS_HIGH_DIFFICULTY: {
    id: 'kids_high_difficulty',
    name: '儿童区误用高难点',
    description: '儿童区域设置了过高难度的岩点，不适合儿童攀爬',
    severity: 'high'
  },
  LOW_RATING: {
    id: 'low_rating',
    name: '会员低评分',
    description: '会员反馈评分较低，需要关注',
    severity: 'medium'
  },
  HOTSPOT: {
    id: 'hotspot',
    name: '高使用热区',
    description: '该区域使用频率过高，岩点磨损严重',
    severity: 'low'
  }
};

function getRiskTypes(req, res) {
  try {
    res.json({ success: true, data: Object.values(RISK_TYPES) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function calculateDistance(pos1, pos2) {
  const dx = (pos1.x || 0) - (pos2.x || 0);
  const dy = (pos1.y || 0) - (pos2.y || 0);
  const dz = (pos1.z || 0) - (pos2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function analyzeOvercrowding(routes, holds, wall) {
  const risks = [];
  const threshold = 0.6;

  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const route1 = routes[i];
      const route2 = routes[j];
      
      let hasCloseHold = false;
      let closeHolds = [];

      for (const holdId1 of route1.holdIds) {
        for (const holdId2 of route2.holdIds) {
          const hold1 = holds.find(h => h.id === holdId1);
          const hold2 = holds.find(h => h.id === holdId2);
          
          if (hold1 && hold2) {
            const distance = calculateDistance(hold1.position, hold2.position);
            if (distance < threshold) {
              hasCloseHold = true;
              closeHolds.push({
                hold1: { id: hold1.id, position: hold1.position },
                hold2: { id: hold2.id, position: hold2.position },
                distance
              });
            }
          }
        }
      }

      if (hasCloseHold) {
        risks.push({
          id: generateId(),
          riskType: RISK_TYPES.OVERCROWDING.id,
          riskName: RISK_TYPES.OVERCROWDING.name,
          severity: RISK_TYPES.OVERCROWDING.severity,
          description: `路线 "${route1.name}" 和 "${route2.name}" 存在岩点拥挤问题`,
          affectedRoutes: [route1.id, route2.id],
          affectedRouteNames: [route1.name, route2.name],
          details: closeHolds,
          wallId: wall?.id,
          wallName: wall?.name,
          suggestion: '建议调整其中一条路线的岩点位置，或将其中一条路线移动到其他区域',
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  return risks;
}

function analyzeLargeSpan(routes, holds, wall) {
  const risks = [];
  const threshold = 1.8;

  for (const route of routes) {
    const routeHolds = route.holdIds
      .map(id => holds.find(h => h.id === id))
      .filter(h => h);

    for (let i = 0; i < routeHolds.length - 1; i++) {
      const distance = calculateDistance(routeHolds[i].position, routeHolds[i + 1].position);
      
      if (distance > threshold) {
        risks.push({
          id: generateId(),
          riskType: RISK_TYPES.LARGE_SPAN.id,
          riskName: RISK_TYPES.LARGE_SPAN.name,
          severity: RISK_TYPES.LARGE_SPAN.severity,
          description: `路线 "${route.name}" 中岩点跨距过大 (${distance.toFixed(2)}m)`,
          affectedRoutes: [route.id],
          affectedRouteNames: [route.name],
          details: {
            hold1: { id: routeHolds[i].id, position: routeHolds[i].position },
            hold2: { id: routeHolds[i + 1].id, position: routeHolds[i + 1].position },
            distance
          },
          wallId: wall?.id,
          wallName: wall?.name,
          suggestion: `建议在两个岩点之间添加中间岩点，或调整岩点位置使跨距小于 ${threshold}m`,
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  return risks;
}

function analyzeKidsHighDifficulty(routes, holds, walls) {
  const risks = [];
  const kidsWalls = walls.filter(w => w.isKidsArea);
  const highDifficultyThreshold = ['V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10+'];

  for (const wall of kidsWalls) {
    const wallRoutes = routes.filter(r => r.wallId === wall.id);
    
    for (const route of wallRoutes) {
      if (highDifficultyThreshold.includes(route.difficulty)) {
        risks.push({
          id: generateId(),
          riskType: RISK_TYPES.KIDS_HIGH_DIFFICULTY.id,
          riskName: RISK_TYPES.KIDS_HIGH_DIFFICULTY.name,
          severity: RISK_TYPES.KIDS_HIGH_DIFFICULTY.severity,
          description: `儿童区 "${wall.name}" 中存在高难度路线 "${route.name}" (难度: ${route.difficulty})`,
          affectedRoutes: [route.id],
          affectedRouteNames: [route.name],
          details: {
            wallId: wall.id,
            wallName: wall.name,
            routeDifficulty: route.difficulty
          },
          wallId: wall.id,
          wallName: wall.name,
          suggestion: '建议将此高难度路线移至成人区域，或降低儿童区路线的难度等级',
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  return risks;
}

function analyzeLowRating(feedback, routes) {
  const risks = [];
  const threshold = 2;

  const routeRatings = {};
  for (const fb of feedback) {
    if (fb.routeId) {
      if (!routeRatings[fb.routeId]) {
        routeRatings[fb.routeId] = { ratings: [], comments: [], issues: [] };
      }
      routeRatings[fb.routeId].ratings.push(fb.rating);
      if (fb.comment) routeRatings[fb.routeId].comments.push(fb.comment);
      if (fb.issues && fb.issues.length) routeRatings[fb.routeId].issues.push(...fb.issues);
    }
  }

  for (const [routeId, data] of Object.entries(routeRatings)) {
    const avgRating = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
    const route = routes.find(r => r.id === routeId);
    
    if (avgRating <= threshold && route) {
      risks.push({
        id: generateId(),
        riskType: RISK_TYPES.LOW_RATING.id,
        riskName: RISK_TYPES.LOW_RATING.name,
        severity: RISK_TYPES.LOW_RATING.severity,
        description: `路线 "${route.name}" 会员平均评分较低 (${avgRating.toFixed(1)}/5)`,
        affectedRoutes: [routeId],
        affectedRouteNames: [route.name],
        details: {
          averageRating: avgRating,
          totalReviews: data.ratings.length,
          sampleComments: data.comments.slice(0, 5),
          commonIssues: [...new Set(data.issues)]
        },
        wallId: route.wallId,
        suggestion: '建议查看会员反馈详情，考虑调整路线或更换岩点类型',
        createdAt: new Date().toISOString()
      });
    }
  }

  return risks;
}

function analyzeHotspots(heatmap, routes, holds) {
  const risks = [];
  const threshold = 80;

  const highIntensityAreas = heatmap.filter(h => h.intensity >= threshold);
  
  for (const area of highIntensityAreas) {
    const nearbyRoutes = routes.filter(route => {
      const routeHolds = route.holdIds
        .map(id => holds.find(h => h.id === id))
        .filter(h => h);
      
      return routeHolds.some(hold => {
        const distance = calculateDistance(hold.position, area.position);
        return distance < 1.0;
      });
    });

    if (nearbyRoutes.length > 0) {
      risks.push({
        id: generateId(),
        riskType: RISK_TYPES.HOTSPOT.id,
        riskName: RISK_TYPES.HOTSPOT.name,
        severity: RISK_TYPES.HOTSPOT.severity,
        description: `区域 (${area.position.x.toFixed(1)}, ${area.position.y.toFixed(1)}) 为高使用热区，强度: ${area.intensity}%`,
        affectedRoutes: nearbyRoutes.map(r => r.id),
        affectedRouteNames: nearbyRoutes.map(r => r.name),
        details: {
          position: area.position,
          intensity: area.intensity,
          climberCount: area.climberCount,
          sessionCount: area.sessionCount
        },
        wallId: area.wallId,
        suggestion: '建议检查该区域岩点磨损情况，考虑轮换使用或加强维护',
        createdAt: new Date().toISOString()
      });
    }
  }

  return risks;
}

function analyzeRisks(req, res) {
  try {
    const { wallId } = req.query;
    
    let walls = dataStore.walls;
    let routes = dataStore.routes;
    let holds = dataStore.holds;
    let heatmap = dataStore.heatmap;
    let feedback = dataStore.feedback;

    if (wallId) {
      walls = walls.filter(w => w.id === wallId);
      routes = routes.filter(r => r.wallId === wallId);
      holds = holds.filter(h => h.wallId === wallId);
      heatmap = heatmap.filter(h => h.wallId === wallId);
    }

    const allRisks = [];

    for (const wall of walls) {
      const wallRoutes = routes.filter(r => r.wallId === wall.id);
      const wallHolds = holds.filter(h => h.wallId === wall.id);
      const wallHeatmap = heatmap.filter(h => h.wallId === wall.id);

      allRisks.push(...analyzeOvercrowding(wallRoutes, wallHolds, wall));
      allRisks.push(...analyzeLargeSpan(wallRoutes, wallHolds, wall));
    }

    allRisks.push(...analyzeKidsHighDifficulty(routes, holds, walls));
    allRisks.push(...analyzeLowRating(feedback, routes));
    allRisks.push(...analyzeHotspots(heatmap, routes, holds));

    const groupedByType = {};
    for (const risk of allRisks) {
      if (!groupedByType[risk.riskType]) {
        groupedByType[risk.riskType] = [];
      }
      groupedByType[risk.riskType].push(risk);
    }

    const summary = {
      totalRisks: allRisks.length,
      bySeverity: {
        high: allRisks.filter(r => r.severity === 'high').length,
        medium: allRisks.filter(r => r.severity === 'medium').length,
        low: allRisks.filter(r => r.severity === 'low').length
      },
      byType: Object.keys(groupedByType).map(type => ({
        type,
        count: groupedByType[type].length,
        risks: groupedByType[type]
      }))
    };

    dataStore.riskAnalysis = allRisks;
    saveData('riskAnalysis');

    res.json({ 
      success: true, 
      data: {
        summary,
        risks: allRisks
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getRiskTypes,
  analyzeRisks
};
