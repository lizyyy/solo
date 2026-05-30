import { KitchenLayout, Anomaly, ValidationRule } from '../types';
import { CONCENTRATION_LIMITS, RECOMMENDED_AIRFLOW_PER_STOVE, normalizeToMeters } from '../utils/units';

function generateId(): string {
  return 'anomaly_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export const validationRules: ValidationRule[] = [
  {
    id: 'dimensions_positive',
    name: '厨房尺寸验证',
    category: 'data',
    severity: 'error',
    validate: (layout: KitchenLayout): Anomaly | null => {
      const width = normalizeToMeters(layout.dimensions.width, layout.dimensions.unit);
      const height = normalizeToMeters(layout.dimensions.height, layout.dimensions.unit);
      if (width <= 0 || height <= 0) {
        return {
          id: generateId(),
          category: 'data',
          severity: 'error',
          field: 'dimensions',
          message: '厨房尺寸必须为正值',
          suggestion: '请检查厨房宽度和高度设置，确保大于0',
          value: { width, height },
          expected: 'width > 0, height > 0'
        };
      }
      return null;
    }
  },
  {
    id: 'grid_resolution',
    name: '网格分辨率验证',
    category: 'data',
    severity: 'warning',
    validate: (layout: KitchenLayout): Anomaly | null => {
      if (layout.gridResolution < 0.05 || layout.gridResolution > 1) {
        return {
          id: generateId(),
          category: 'data',
          severity: 'warning',
          field: 'gridResolution',
          message: '网格分辨率不在推荐范围(0.05-1m)',
          suggestion: '建议设置0.1-0.5m之间的网格分辨率以平衡精度和计算速度',
          value: layout.gridResolution,
          expected: '0.05 <= gridResolution <= 1'
        };
      }
      return null;
    }
  },
  {
    id: 'stove_count',
    name: '灶位数量检查',
    category: 'material',
    severity: 'info',
    validate: (layout: KitchenLayout): Anomaly | null => {
      const enabledStoves = layout.stoves.filter(s => s.enabled);
      if (enabledStoves.length === 0) {
        return {
          id: generateId(),
          category: 'material',
          severity: 'warning',
          field: 'stoves',
          message: '未配置任何启用的灶位',
          suggestion: '请添加灶位数据或检查灶位启用状态',
          value: enabledStoves.length,
          expected: '至少1个启用的灶位'
        };
      }
      return null;
    }
  },
  {
    id: 'stove_position_bounds',
    name: '灶位边界检查',
    category: 'data',
    severity: 'error',
    validate: (layout: KitchenLayout): Anomaly | null => {
      const kitchenWidth = normalizeToMeters(layout.dimensions.width, layout.dimensions.unit);
      const kitchenHeight = normalizeToMeters(layout.dimensions.height, layout.dimensions.unit);
      
      for (const stove of layout.stoves) {
        const x = normalizeToMeters(stove.position.x, stove.position.unit);
        const y = normalizeToMeters(stove.position.y, stove.position.unit);
        const w = normalizeToMeters(stove.dimensions.width, stove.dimensions.unit);
        const h = normalizeToMeters(stove.dimensions.height, stove.dimensions.unit);
        
        if (x < 0 || y < 0 || x + w > kitchenWidth || y + h > kitchenHeight) {
          return {
            id: generateId(),
            category: 'data',
            severity: 'error',
            field: `stoves.${stove.id}.position`,
            message: `灶位"${stove.name}"超出厨房边界`,
            suggestion: '请调整灶位位置，确保所有灶位在厨房范围内',
            value: { x, y, w, h, kitchenWidth, kitchenHeight },
            expected: '灶位在厨房边界内'
          };
        }
      }
      return null;
    }
  },
  {
    id: 'exhaust_count',
    name: '排烟口数量检查',
    category: 'material',
    severity: 'warning',
    validate: (layout: KitchenLayout): Anomaly | null => {
      const enabledExhausts = layout.exhaustVents.filter(e => e.enabled);
      if (enabledExhausts.length === 0) {
        return {
          id: generateId(),
          category: 'material',
          severity: 'warning',
          field: 'exhaustVents',
          message: '未配置任何启用的排烟口',
          suggestion: '请添加排烟口数据或检查排烟口启用状态',
          value: enabledExhausts.length,
          expected: '至少1个启用的排烟口'
        };
      }
      return null;
    }
  },
  {
    id: 'exhaust_position_bounds',
    name: '排烟口边界检查',
    category: 'data',
    severity: 'error',
    validate: (layout: KitchenLayout): Anomaly | null => {
      const kitchenWidth = normalizeToMeters(layout.dimensions.width, layout.dimensions.unit);
      const kitchenHeight = normalizeToMeters(layout.dimensions.height, layout.dimensions.unit);
      
      for (const vent of layout.exhaustVents) {
        const x = normalizeToMeters(vent.position.x, vent.position.unit);
        const y = normalizeToMeters(vent.position.y, vent.position.unit);
        const w = normalizeToMeters(vent.dimensions.width, vent.dimensions.unit);
        const h = normalizeToMeters(vent.dimensions.height, vent.dimensions.unit);
        
        if (x < 0 || y < 0 || x + w > kitchenWidth || y + h > kitchenHeight) {
          return {
            id: generateId(),
            category: 'data',
            severity: 'error',
            field: `exhaustVents.${vent.id}.position`,
            message: `排烟口"${vent.name}"超出厨房边界`,
            suggestion: '请调整排烟口位置，确保所有排烟口在厨房范围内',
            value: { x, y, w, h, kitchenWidth, kitchenHeight },
            expected: '排烟口在厨房边界内'
          };
        }
      }
      return null;
    }
  },
  {
    id: 'airflow_rate',
    name: '风量合理性检查',
    category: 'rule',
    severity: 'warning',
    validate: (layout: KitchenLayout): Anomaly | null => {
      const enabledStoves = layout.stoves.filter(s => s.enabled);
      const totalRecommendedAirflow = enabledStoves.reduce((sum, s) => 
        sum + (RECOMMENDED_AIRFLOW_PER_STOVE[s.type] || 2500), 0);
      
      const totalActualAirflow = layout.exhaustVents
        .filter(e => e.enabled)
        .reduce((sum, e) => sum + e.airflowRate, 0);
      
      const ratio = totalActualAirflow / totalRecommendedAirflow;
      
      if (ratio < 0.7) {
        return {
          id: generateId(),
          category: 'rule',
          severity: 'warning',
          field: 'exhaustVents.airflowRate',
          message: `总风量(${totalActualAirflow}m³/h)低于推荐值(${totalRecommendedAirflow}m³/h)的70%`,
          suggestion: '建议增加排烟口风量，确保油烟能有效排出',
          value: { totalActualAirflow, totalRecommendedAirflow, ratio: ratio.toFixed(2) },
          expected: `风量 >= ${(totalRecommendedAirflow * 0.7).toFixed(0)}m³/h`
        };
      }
      if (ratio > 2.0) {
        return {
          id: generateId(),
          category: 'rule',
          severity: 'info',
          field: 'exhaustVents.airflowRate',
          message: `总风量(${totalActualAirflow}m³/h)超过推荐值(${totalRecommendedAirflow}m³/h)的2倍`,
          suggestion: '风量过大可能造成能源浪费，可考虑优化',
          value: { totalActualAirflow, totalRecommendedAirflow, ratio: ratio.toFixed(2) },
          expected: '合理的风量范围'
        };
      }
      return null;
    }
  },
  {
    id: 'capture_efficiency',
    name: '捕集效率检查',
    category: 'data',
    severity: 'warning',
    validate: (layout: KitchenLayout): Anomaly | null => {
      for (const vent of layout.exhaustVents) {
        if (vent.captureEfficiency < 0 || vent.captureEfficiency > 1) {
          return {
            id: generateId(),
            category: 'data',
            severity: 'warning',
            field: `exhaustVents.${vent.id}.captureEfficiency`,
            message: `排烟口"${vent.name}"的捕集效率应在0-1之间`,
            suggestion: '捕集效率建议设置在0.6-0.95之间',
            value: vent.captureEfficiency,
            expected: '0 <= captureEfficiency <= 1'
          };
        }
      }
      return null;
    }
  },
  {
    id: 'detection_point_threshold',
    name: '检测点阈值检查',
    category: 'rule',
    severity: 'info',
    validate: (layout: KitchenLayout): Anomaly | null => {
      for (const point of layout.detectionPoints) {
        if (point.threshold && point.threshold > CONCENTRATION_LIMITS.LEGAL_LIMIT_MG_M3) {
          return {
            id: generateId(),
            category: 'rule',
            severity: 'info',
            field: `detectionPoints.${point.id}.threshold`,
            message: `检测点"${point.name}"的阈值(${point.threshold}mg/m³)超过法定限值`,
            suggestion: `建议将阈值设置为${CONCENTRATION_LIMITS.LEGAL_LIMIT_MG_M3}mg/m³以下`,
            value: point.threshold,
            expected: `threshold <= ${CONCENTRATION_LIMITS.LEGAL_LIMIT_MG_M3}`
          };
        }
      }
      return null;
    }
  },
  {
    id: 'obstacle_overlap',
    name: '障碍物重叠检查',
    category: 'data',
    severity: 'warning',
    validate: (layout: KitchenLayout): Anomaly | null => {
      const obstacles = layout.obstacles;
      for (let i = 0; i < obstacles.length; i++) {
        for (let j = i + 1; j < obstacles.length; j++) {
          const a = obstacles[i];
          const b = obstacles[j];
          const ax = normalizeToMeters(a.position.x, a.position.unit);
          const ay = normalizeToMeters(a.position.y, a.position.unit);
          const aw = normalizeToMeters(a.dimensions.width, a.dimensions.unit);
          const ah = normalizeToMeters(a.dimensions.height, a.dimensions.unit);
          const bx = normalizeToMeters(b.position.x, b.position.unit);
          const by = normalizeToMeters(b.position.y, b.position.unit);
          const bw = normalizeToMeters(b.dimensions.width, b.dimensions.unit);
          const bh = normalizeToMeters(b.dimensions.height, b.dimensions.unit);
          
          if (ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by) {
            return {
              id: generateId(),
              category: 'data',
              severity: 'warning',
              field: 'obstacles',
              message: `障碍物"${a.name}"与"${b.name}"存在重叠`,
              suggestion: '请调整障碍物位置，避免重叠影响模拟精度',
              value: [a.name, b.name],
              expected: '障碍物无重叠'
            };
          }
        }
      }
      return null;
    }
  },
  {
    id: 'version_info',
    name: '版本信息检查',
    category: 'material',
    severity: 'info',
    validate: (layout: KitchenLayout): Anomaly | null => {
      if (!layout.version.createdBy || !layout.version.modifiedBy) {
        return {
          id: generateId(),
          category: 'material',
          severity: 'info',
          field: 'version',
          message: '版本信息不完整',
          suggestion: '请填写创建人和修改人信息，便于追踪修改历史',
          value: { createdBy: layout.version.createdBy, modifiedBy: layout.version.modifiedBy },
          expected: '完整的版本追踪信息'
        };
      }
      return null;
    }
  },
  {
    id: 'fume_emission_rate',
    name: '油烟排放率检查',
    category: 'data',
    severity: 'warning',
    validate: (layout: KitchenLayout): Anomaly | null => {
      for (const stove of layout.stoves) {
        if (stove.fumeEmissionRate <= 0) {
          return {
            id: generateId(),
            category: 'data',
            severity: 'warning',
            field: `stoves.${stove.id}.fumeEmissionRate`,
            message: `灶位"${stove.name}"的油烟排放率应为正值`,
            suggestion: '请设置合理的油烟排放率（mg/s）',
            value: stove.fumeEmissionRate,
            expected: 'fumeEmissionRate > 0'
          };
        }
      }
      return null;
    }
  },
  {
    id: 'stove_exhaust_distance',
    name: '灶位与排烟口距离检查',
    category: 'rule',
    severity: 'warning',
    validate: (layout: KitchenLayout): Anomaly | null => {
      const enabledStoves = layout.stoves.filter(s => s.enabled);
      const enabledExhausts = layout.exhaustVents.filter(e => e.enabled);
      
      if (enabledStoves.length === 0 || enabledExhausts.length === 0) return null;
      
      for (const stove of enabledStoves) {
        const sx = normalizeToMeters(stove.position.x, stove.position.unit);
        const sy = normalizeToMeters(stove.position.y, stove.position.unit);
        const sw = normalizeToMeters(stove.dimensions.width, stove.dimensions.unit);
        const sh = normalizeToMeters(stove.dimensions.height, stove.dimensions.unit);
        const stoveCenterX = sx + sw / 2;
        const stoveCenterY = sy + sh / 2;
        
        let minDistance = Infinity;
        for (const vent of enabledExhausts) {
          const vx = normalizeToMeters(vent.position.x, vent.position.unit);
          const vy = normalizeToMeters(vent.position.y, vent.position.unit);
          const vw = normalizeToMeters(vent.dimensions.width, vent.dimensions.unit);
          const vh = normalizeToMeters(vent.dimensions.height, vent.dimensions.unit);
          const ventCenterX = vx + vw / 2;
          const ventCenterY = vy + vh / 2;
          
          const distance = Math.sqrt(
            Math.pow(stoveCenterX - ventCenterX, 2) + 
            Math.pow(stoveCenterY - ventCenterY, 2)
          );
          minDistance = Math.min(minDistance, distance);
        }
        
        if (minDistance > 2.5) {
          return {
            id: generateId(),
            category: 'rule',
            severity: 'warning',
            field: `stoves.${stove.id}`,
            message: `灶位"${stove.name}"距离最近排烟口较远(${minDistance.toFixed(1)}m)`,
            suggestion: '建议将排烟口设置在灶位正上方或附近，提高捕集效率',
            value: minDistance.toFixed(2) + 'm',
            expected: '距离 <= 2.5m'
          };
        }
      }
      return null;
    }
  }
];

export function validateLayout(layout: KitchenLayout): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  for (const rule of validationRules) {
    try {
      const result = rule.validate(layout);
      if (result) {
        anomalies.push(result);
      }
    } catch (error) {
      anomalies.push({
        id: generateId(),
        category: 'data',
        severity: 'error',
        field: rule.field,
        message: `验证规则"${rule.name}"执行出错: ${error}`,
        suggestion: '请检查数据格式是否正确',
      });
    }
  }
  
  return anomalies;
}
