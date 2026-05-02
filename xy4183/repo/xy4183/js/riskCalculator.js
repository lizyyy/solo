export class RiskCalculator {
  constructor() {
    this.thresholds = {
      slope: {
        safe: 0,
        caution: 15,
        danger: 25,
        severe: 35
      },
      ice: {
        flowThreshold: 100,
        aspectThreshold: 90
      },
      crowd: {
        densityLow: 0.01,
        densityMedium: 0.05,
        densityHigh: 0.1
      }
    };
    
    this.colorMaps = {
      slope: [
        { min: 0, max: 15, r: 0, g: 0.8, b: 0 },
        { min: 15, max: 25, r: 1, g: 1, b: 0 },
        { min: 25, max: 35, r: 1, g: 0.5, b: 0 },
        { min: 35, max: 90, r: 1, g: 0, b: 0 }
      ],
      ice: [
        { min: 0, max: 0.3, r: 0.9, g: 0.9, b: 1 },
        { min: 0.3, max: 0.6, r: 0.7, g: 0.7, b: 1 },
        { min: 0.6, max: 1, r: 0, g: 0, b: 1 }
      ],
      crowd: [
        { min: 0, max: 0.02, r: 0, g: 1, b: 0 },
        { min: 0.02, max: 0.05, r: 0.5, g: 1, b: 0 },
        { min: 0.05, max: 0.1, r: 1, g: 1, b: 0 },
        { min: 0.1, max: 1, r: 1, g: 0, b: 0 }
      ],
      elevation: [
        { min: 0, max: 0.25, r: 0, g: 0.8, b: 0.2 },
        { min: 0.25, max: 0.5, r: 0.3, g: 0.7, b: 0.3 },
        { min: 0.5, max: 0.75, r: 0.6, g: 0.6, b: 0.4 },
        { min: 0.75, max: 1, r: 0.8, g: 0.5, b: 0.3 }
      ],
      composite: [
        { min: 0, max: 0.25, r: 0, g: 1, b: 0 },
        { min: 0.25, max: 0.5, r: 0.5, g: 1, b: 0 },
        { min: 0.5, max: 0.75, r: 1, g: 1, b: 0 },
        { min: 0.75, max: 1, r: 1, g: 0, b: 0 }
      ]
    };
  }

  calculateSlopeRisk(slopeAngle) {
    const angle = Math.abs(slopeAngle);
    
    if (angle < this.thresholds.slope.caution) {
      return { level: 'low', value: angle / this.thresholds.slope.caution, label: '安全' };
    } else if (angle < this.thresholds.slope.danger) {
      return { level: 'medium', value: 0.33 + (angle - this.thresholds.slope.caution) / (this.thresholds.slope.danger - this.thresholds.slope.caution) * 0.33, label: '警告' };
    } else if (angle < this.thresholds.slope.severe) {
      return { level: 'high', value: 0.66 + (angle - this.thresholds.slope.danger) / (this.thresholds.slope.severe - this.thresholds.slope.danger) * 0.33, label: '危险' };
    } else {
      return { level: 'critical', value: 1, label: '严重' };
    }
  }

  calculateIceRisk(point) {
    const { slope, aspect, flowAccumulation } = point;
    
    let riskScore = 0;
    
    if (flowAccumulation > this.thresholds.ice.flowThreshold) {
      riskScore += 0.5;
    }
    
    const normalizedFlow = Math.min(flowAccumulation / 500, 1);
    riskScore += normalizedFlow * 0.3;
    
    const aspectInRadians = aspect * Math.PI / 180;
    const northernExposure = (1 - Math.cos(aspectInRadians)) / 2;
    riskScore += northernExposure * 0.2;
    
    riskScore += (slope / 30) * 0.2;
    
    riskScore = Math.min(riskScore, 1);
    
    let level = 'low';
    let label = '低风险';
    
    if (riskScore > 0.7) {
      level = 'high';
      label = '高结冰风险';
    } else if (riskScore > 0.4) {
      level = 'medium';
      label = '中结冰风险';
    }
    
    return { level, value: riskScore, label };
  }

  calculateCrowdRisk(point, crowdData = {}) {
    const { location } = point;
    const baseDensity = crowdData.baseDensity || 0.03;
    
    let riskScore = baseDensity;
    
    const attractionRisk = crowdData.attractions?.some(attr => {
      const dx = location.x - attr.x;
      const dy = location.y - attr.y;
      return Math.sqrt(dx * dx + dy * dy) < (attr.radius || 50);
    }) || false;
    
    if (attractionRisk) {
      riskScore += 0.1;
    }
    
    const slopeRisk = this.calculateSlopeRisk(point.slope);
    if (slopeRisk.level === 'high' || slopeRisk.level === 'critical') {
      riskScore += 0.05;
    }
    
    riskScore = Math.min(riskScore, 1);
    
    let level = 'low';
    let label = '客流正常';
    
    if (riskScore > this.thresholds.crowd.densityHigh) {
      level = 'high';
      label = '客流拥挤';
    } else if (riskScore > this.thresholds.crowd.densityMedium) {
      level = 'medium';
      label = '客流较多';
    }
    
    return { level, value: riskScore, label };
  }

  calculateCompositeRisk(point, crowdData = {}) {
    const slopeRisk = this.calculateSlopeRisk(point.slope);
    const iceRisk = this.calculateIceRisk(point);
    const crowdRisk = this.calculateCrowdRisk(point, crowdData);
    
    const weights = {
      slope: 0.5,
      ice: 0.3,
      crowd: 0.2
    };
    
    const compositeScore = 
      slopeRisk.value * weights.slope + 
      iceRisk.value * weights.ice + 
      crowdRisk.value * weights.crowd;
    
    let level = 'low';
    let label = '综合安全';
    
    if (compositeScore > 0.7) {
      level = 'high';
      label = '综合高风险';
    } else if (compositeScore > 0.4) {
      level = 'medium';
      label = '综合中风险';
    }
    
    return {
      level,
      value: compositeScore,
      label,
      details: {
        slope: slopeRisk,
        ice: iceRisk,
        crowd: crowdRisk
      }
    };
  }

  getColorForPoint(point, viewMode = 'slope', bounds = null, crowdData = {}) {
    let value = 0;
    
    switch (viewMode) {
      case 'slope':
        value = Math.min(point.slope / 45, 1);
        break;
      case 'ice':
        value = this.calculateIceRisk(point).value;
        break;
      case 'crowd':
        value = this.calculateCrowdRisk(point, crowdData).value;
        break;
      case 'elevation':
        if (bounds) {
          value = (point.z - bounds.minZ) / (bounds.maxZ - bounds.minZ);
        } else {
          value = 0.5;
        }
        break;
      case 'composite':
        value = this.calculateCompositeRisk(point, crowdData).value;
        break;
      default:
        value = Math.min(point.slope / 45, 1);
    }
    
    return this._interpolateColor(value, this.colorMaps[viewMode] || this.colorMaps.slope);
  }

  _interpolateColor(value, colorMap) {
    value = Math.max(0, Math.min(1, value));
    
    let lowerBound = colorMap[0];
    let upperBound = colorMap[colorMap.length - 1];
    
    for (let i = 0; i < colorMap.length - 1; i++) {
      if (value >= colorMap[i].min && value <= colorMap[i + 1].max) {
        lowerBound = colorMap[i];
        upperBound = colorMap[i + 1];
        break;
      }
    }
    
    const range = upperBound.max - lowerBound.min;
    const t = range === 0 ? 0 : (value - lowerBound.min) / range;
    
    return {
      r: lowerBound.r + (upperBound.r - lowerBound.r) * t,
      g: lowerBound.g + (upperBound.g - lowerBound.g) * t,
      b: lowerBound.b + (upperBound.b - lowerBound.b) * t
    };
  }

  getRiskLegend(viewMode = 'slope') {
    const legends = {
      slope: [
        { color: '#00cc00', label: '0-15° 缓坡安全' },
        { color: '#ffff00', label: '15-25° 注意速度' },
        { color: '#ff8000', label: '25-35° 陡坡危险' },
        { color: '#ff0000', label: '>35° 极陡坡严重' }
      ],
      ice: [
        { color: '#e6e6ff', label: '低结冰风险' },
        { color: '#b3b3ff', label: '中结冰风险' },
        { color: '#0000ff', label: '高结冰风险' }
      ],
      crowd: [
        { color: '#00ff00', label: '客流正常' },
        { color: '#80ff00', label: '客流适中' },
        { color: '#ffff00', label: '客流较多' },
        { color: '#ff0000', label: '客流拥挤' }
      ],
      elevation: [
        { color: '#00cc33', label: '低海拔' },
        { color: '#4db34d', label: '中低海拔' },
        { color: '#999966', label: '中高海拔' },
        { color: '#cc804d', label: '高海拔' }
      ],
      composite: [
        { color: '#00ff00', label: '综合安全' },
        { color: '#80ff00', label: '综合低风险' },
        { color: '#ffff00', label: '综合中风险' },
        { color: '#ff0000', label: '综合高风险' }
      ]
    };
    
    return legends[viewMode] || legends.slope;
  }

  analyzeHighRiskAreas(elevationData, crowdData = {}) {
    const highRiskAreas = [];
    const { points } = elevationData;
    
    const gridSize = 10;
    const cellMap = new Map();
    
    for (const point of points) {
      const compositeRisk = this.calculateCompositeRisk(point, crowdData);
      
      if (compositeRisk.level === 'high' || compositeRisk.level === 'critical') {
        const cellX = Math.floor(point.x / gridSize);
        const cellY = Math.floor(point.y / gridSize);
        const cellKey = `${cellX},${cellY}`;
        
        if (!cellMap.has(cellKey)) {
          cellMap.set(cellKey, {
            points: [],
            maxRisk: 0,
            centerX: 0,
            centerY: 0
          });
        }
        
        const cell = cellMap.get(cellKey);
        cell.points.push(point);
        cell.maxRisk = Math.max(cell.maxRisk, compositeRisk.value);
      }
    }
    
    for (const [key, cell] of cellMap) {
      if (cell.points.length >= 3) {
        const centerX = cell.points.reduce((sum, p) => sum + p.x, 0) / cell.points.length;
        const centerY = cell.points.reduce((sum, p) => sum + p.y, 0) / cell.points.length;
        const avgZ = cell.points.reduce((sum, p) => sum + p.z, 0) / cell.points.length;
        
        highRiskAreas.push({
          id: `risk_area_${highRiskAreas.length}`,
          location: { x: centerX, y: centerY, z: avgZ },
          radius: Math.sqrt(cell.points.length) * gridSize / 2,
          riskLevel: cell.maxRisk > 0.7 ? 'high' : 'medium',
          riskScore: cell.maxRisk,
          pointCount: cell.points.length,
          description: `高风险区域，包含${cell.points.length}个风险点`
        });
      }
    }
    
    return highRiskAreas.sort((a, b) => b.riskScore - a.riskScore);
  }
}
