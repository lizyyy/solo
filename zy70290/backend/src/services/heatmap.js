import { v4 as uuidv4 } from 'uuid';
import store from '../store.js';
import { STAGES, updateBusinessStatus, updateDataSummary, addProblem } from '../utils/status.js';

const GRID_SIZE = 20;
const HEAT_THRESHOLDS = {
  cold: { max: 0.3, color: '#1e88e5', label: '冷区' },
  warm: { min: 0.3, max: 0.6, color: '#ff9800', label: '温区' },
  hot: { min: 0.6, max: 0.85, color: '#f44336', label: '热区' },
  critical: { min: 0.85, color: '#9c27b0', label: '极热区' }
};

function calculateHeatmap(options = {}) {
  updateBusinessStatus(STAGES.HEATMAP_CALCULATION, null, ['开始计算热区数据']);
  
  const validPoints = store.stopPoints.filter(p => p.status === 'valid');
  const exhibitions = store.exhibitions;
  
  if (validPoints.length === 0) {
    updateBusinessStatus(STAGES.HEATMAP_CALCULATION, 'no_valid_data', ['没有可用的停留点数据']);
    return { success: false, message: '没有可用的停留点数据' };
  }
  
  if (exhibitions.length === 0) {
    updateBusinessStatus(STAGES.HEATMAP_CALCULATION, 'no_exhibitions', ['需要先配置展区分组']);
    return { success: false, message: '需要先配置展区分组' };
  }
  
  const suggestions = [];
  const gridHeat = buildHeatGrid(validPoints);
  const exhibitionHeat = calculateExhibitionHeat(validPoints, exhibitions, gridHeat);
  
  const heatmap = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    gridSize: GRID_SIZE,
    gridHeat,
    exhibitionHeat,
    overallStats: calculateOverallStats(exhibitionHeat),
    timeRange: options.timeRange || null
  };
  
  store.heatmaps.push(heatmap);
  store.heatmapHistory.push({
    id: heatmap.id,
    timestamp: heatmap.timestamp,
    overallStats: heatmap.overallStats,
    totalValidPoints: validPoints.length
  });
  
  updateDataSummary();
  
  const analysisResult = analyzeHeatmapResult(heatmap, exhibitions);
  suggestions.push(...analysisResult.suggestions);
  
  for (const warning of analysisResult.warnings) {
    addProblem('heatmap_warning', 'warning', 'heatmap_calculation', warning.message, warning.data);
  }
  
  if (analysisResult.anomalies.length > 0) {
    suggestions.push(`发现 ${analysisResult.anomalies.length} 个异常区域，请检查问题列表`);
  }
  
  suggestions.push('热区计算完成，可查看安保巡逻建议');
  
  updateBusinessStatus(STAGES.SECURITY_RECOMMENDATION, null, suggestions);
  
  return {
    success: true,
    heatmapId: heatmap.id,
    message: '热区计算完成',
    suggestions: analysisResult.suggestions
  };
}

function buildHeatGrid(validPoints) {
  const cols = Math.ceil(1000 / GRID_SIZE);
  const rows = Math.ceil(800 / GRID_SIZE);
  
  const grid = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      grid.push({
        gridX: x,
        gridY: y,
        x: x * GRID_SIZE,
        y: y * GRID_SIZE,
        visitorCount: 0,
        totalDuration: 0,
        avgDuration: 0,
        heatScore: 0
      });
    }
  }
  
  for (const point of validPoints) {
    const data = point.normalizedData;
    const gridX = Math.floor(data.x / GRID_SIZE);
    const gridY = Math.floor(data.y / GRID_SIZE);
    const gridIndex = gridY * cols + gridX;
    
    if (grid[gridIndex]) {
      grid[gridIndex].visitorCount++;
      grid[gridIndex].totalDuration += data.duration;
    }
  }
  
  let maxDuration = 0;
  let maxVisitors = 0;
  
  for (const cell of grid) {
    if (cell.visitorCount > 0) {
      cell.avgDuration = cell.totalDuration / cell.visitorCount;
    }
    if (cell.totalDuration > maxDuration) maxDuration = cell.totalDuration;
    if (cell.visitorCount > maxVisitors) maxVisitors = cell.visitorCount;
  }
  
  for (const cell of grid) {
    if (maxDuration > 0 && maxVisitors > 0) {
      const durationScore = cell.totalDuration / maxDuration;
      const visitorScore = cell.visitorCount / maxVisitors;
      cell.heatScore = durationScore * 0.6 + visitorScore * 0.4;
    }
    cell.heatLevel = getHeatLevel(cell.heatScore);
  }
  
  return grid.filter(cell => cell.visitorCount > 0);
}

function getHeatLevel(score) {
  if (score >= HEAT_THRESHOLDS.critical.min) return 'critical';
  if (score >= HEAT_THRESHOLDS.hot.min) return 'hot';
  if (score >= HEAT_THRESHOLDS.warm.min) return 'warm';
  return 'cold';
}

function calculateExhibitionHeat(validPoints, exhibitions, gridHeat) {
  return exhibitions.map(exhibition => {
    const box = exhibition.boundingBox;
    const pointsInExhibition = validPoints.filter(p => {
      const data = p.normalizedData;
      return data.x >= box.x && 
             data.x <= box.x + box.width &&
             data.y >= box.y && 
             data.y <= box.y + box.height;
    });
    
    const gridCellsInExhibition = gridHeat.filter(cell => 
      cell.x >= box.x && 
      cell.x <= box.x + box.width &&
      cell.y >= box.y && 
      cell.y <= box.y + box.height
    );
    
    const totalDuration = pointsInExhibition.reduce((sum, p) => sum + p.normalizedData.duration, 0);
    const avgDuration = pointsInExhibition.length > 0 ? totalDuration / pointsInExhibition.length : 0;
    const heatScore = gridCellsInExhibition.length > 0 
      ? gridCellsInExhibition.reduce((sum, c) => sum + c.heatScore, 0) / gridCellsInExhibition.length 
      : 0;
    
    const durationRatio = exhibition.expectedDuration > 0 
      ? avgDuration / exhibition.expectedDuration 
      : 0;
    
    return {
      exhibitionId: exhibition.id,
      exhibitionName: exhibition.name,
      priority: exhibition.priority,
      visitorCount: pointsInExhibition.length,
      totalDuration,
      avgDuration,
      expectedDuration: exhibition.expectedDuration,
      durationRatio,
      heatScore,
      heatLevel: getHeatLevel(heatScore),
      gridCells: gridCellsInExhibition.length,
      deviatedFromExpected: durationRatio > 1.5 || durationRatio < 0.5
    };
  });
}

function calculateOverallStats(exhibitionHeat) {
  const allCells = exhibitionHeat.filter(e => e.visitorCount > 0);
  
  if (allCells.length === 0) {
    return {
      avgHeatScore: 0,
      maxHeatScore: 0,
      totalVisitors: 0,
      hotExhibitions: 0,
      coldExhibitions: 0,
      criticalCount: 0,
      hotCount: 0,
      warmCount: 0,
      coldCount: 0
    };
  }
  
  const avgHeat = allCells.reduce((sum, e) => sum + e.heatScore, 0) / allCells.length;
  const maxHeat = Math.max(...allCells.map(e => e.heatScore));
  const totalVisitors = allCells.reduce((sum, e) => sum + e.visitorCount, 0);
  
  return {
    avgHeatScore: avgHeat,
    maxHeatScore: maxHeat,
    totalVisitors,
    hotExhibitions: allCells.filter(e => e.heatLevel === 'hot' || e.heatLevel === 'critical').length,
    coldExhibitions: allCells.filter(e => e.heatLevel === 'cold').length,
    criticalCount: allCells.filter(e => e.heatLevel === 'critical').length,
    hotCount: allCells.filter(e => e.heatLevel === 'hot').length,
    warmCount: allCells.filter(e => e.heatLevel === 'warm').length,
    coldCount: allCells.filter(e => e.heatLevel === 'cold').length
  };
}

function analyzeHeatmapResult(heatmap, exhibitions) {
  const suggestions = [];
  const warnings = [];
  const anomalies = [];
  
  for (const exHeat of heatmap.exhibitionHeat) {
    if (exHeat.heatLevel === 'critical') {
      suggestions.push(`极热区警告: "${exHeat.exhibitionName}" 人群高度集中 (热度: ${(exHeat.heatScore * 100).toFixed(0)}%)`);
      anomalies.push({ type: 'critical_heat', exhibition: exHeat.exhibitionName });
    }
    
    if (exHeat.deviatedFromExpected) {
      const direction = exHeat.durationRatio > 1.5 ? '超出' : '低于';
      const msg = `展区"${exHeat.exhibitionName}"实际停留时间${direction}预期 ${(exHeat.durationRatio * 100).toFixed(0)}%`;
      suggestions.push(msg);
      warnings.push({
        message: msg,
        data: {
          exhibitionId: exHeat.exhibitionId,
          exhibitionName: exHeat.exhibitionName,
          actualDuration: exHeat.avgDuration,
          expectedDuration: exHeat.expectedDuration,
          ratio: exHeat.durationRatio
        }
      });
    }
    
    if (exHeat.heatLevel === 'cold' && exHeat.priority === 'high') {
      suggestions.push(`高优先级展区"${exHeat.exhibitionName}"热度较低，建议优化展墙说明`);
    }
  }
  
  const stats = heatmap.overallStats;
  if (stats.criticalCount > 0) {
    suggestions.push(`存在 ${stats.criticalCount} 个极热展区，需重点关注安保`);
  }
  
  if (stats.coldCount > exhibitions.length * 0.5) {
    suggestions.push(`超过半数展区热度较低，建议整体评估展陈效果`);
  }
  
  return { suggestions, warnings, anomalies };
}

function getLatestHeatmap() {
  return store.heatmaps.length > 0 ? store.heatmaps[store.heatmaps.length - 1] : null;
}

function getHeatmapById(id) {
  return store.heatmaps.find(h => h.id === id) || null;
}

function getHeatmapHistory() {
  return store.heatmapHistory;
}

export {
  calculateHeatmap,
  getLatestHeatmap,
  getHeatmapById,
  getHeatmapHistory,
  HEAT_THRESHOLDS
};
