import { SceneState, Risk, DangerZone } from '../types';
import { calculateMaxWeightForRadius, calculateLiftPath } from './cranePhysics';

const generateId = () => `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const seenRiskKeys = new Set<string>();

const addUniqueRisk = (risks: Risk[], risk: Risk) => {
  const key = `${risk.type}-${risk.message}`;
  if (!seenRiskKeys.has(key)) {
    seenRiskKeys.add(key);
    risks.push(risk);
  }
};

export const detectRisks = (state: SceneState): Risk[] => {
  seenRiskKeys.clear();
  const risks: Risk[] = [];
  const { crane, liftObject, environment, dangerZones, buildings } = state;
  
  const sliderRadius = crane.currentRadius;
  
  if (sliderRadius > crane.maxRadius) {
    addUniqueRisk(risks, {
      id: generateId(),
      type: 'radius_exceeded',
      severity: 'critical',
      message: `超半径吊装！设置半径 ${sliderRadius.toFixed(1)}m 超出最大半径 ${crane.maxRadius}m`,
      timestamp: Date.now(),
    });
  }
  
  if (sliderRadius < crane.minRadius) {
    addUniqueRisk(risks, {
      id: generateId(),
      type: 'radius_exceeded',
      severity: 'high',
      message: `作业半径过小！设置半径 ${sliderRadius.toFixed(1)}m 小于最小半径 ${crane.minRadius}m`,
      timestamp: Date.now(),
    });
  }
  
  const maxAllowedWeightForSlider = calculateMaxWeightForRadius(crane, sliderRadius);
  if (liftObject.weight > maxAllowedWeightForSlider) {
    addUniqueRisk(risks, {
      id: generateId(),
      type: 'weight_exceeded',
      severity: 'critical',
      message: `超重！当前重量 ${liftObject.weight}吨 超过设置半径(${sliderRadius.toFixed(1)}m)允许最大值 ${maxAllowedWeightForSlider.toFixed(1)}吨`,
      timestamp: Date.now(),
    });
  }
  
  if (liftObject.weight > crane.maxWeight) {
    addUniqueRisk(risks, {
      id: generateId(),
      type: 'weight_exceeded',
      severity: 'critical',
      message: `超重！当前重量 ${liftObject.weight}吨 超过塔吊最大起重量 ${crane.maxWeight}吨`,
      timestamp: Date.now(),
    });
  }
  
  if (environment.windSpeed > environment.maxAllowedWindSpeed) {
    addUniqueRisk(risks, {
      id: generateId(),
      type: 'wind_exceeded',
      severity: 'high',
      message: `风速超限！当前风速 ${environment.windSpeed}m/s 超过安全值 ${environment.maxAllowedWindSpeed}m/s`,
      timestamp: Date.now(),
    });
  } else if (environment.windSpeed > environment.maxAllowedWindSpeed * 0.8) {
    addUniqueRisk(risks, {
      id: generateId(),
      type: 'wind_exceeded',
      severity: 'medium',
      message: `风速较高！当前风速 ${environment.windSpeed}m/s，请注意作业安全`,
      timestamp: Date.now(),
    });
  }
  
  const sliderAngleRad = (crane.currentAngle * Math.PI) / 180;
  const sliderLiftX = crane.position.x + sliderRadius * Math.sin(sliderAngleRad);
  const sliderLiftZ = crane.position.z + sliderRadius * Math.cos(sliderAngleRad);
  
  for (const zone of dangerZones) {
    if (zone.occupied && zone.type === 'restricted') {
      if (isPositionInZone({ x: sliderLiftX, z: sliderLiftZ }, zone)) {
        addUniqueRisk(risks, {
          id: generateId(),
          type: 'zone_occupied',
          severity: 'high',
          message: `吊臂位置(${sliderRadius.toFixed(1)}m, ${crane.currentAngle.toFixed(1)}°)经过禁区：${zone.name}，请调整`,
          timestamp: Date.now(),
        });
      }
    }
  }
  
  for (let p = 0; p <= 1; p += 0.1) {
    const testProgress = p;
    const testPos = calculateLiftPath(liftObject, testProgress);
    
    for (const zone of dangerZones) {
      if (zone.occupied && zone.type === 'restricted') {
        if (isPositionInZone({ x: testPos.x, z: testPos.z }, zone)) {
          addUniqueRisk(risks, {
            id: generateId(),
            type: 'zone_occupied',
            severity: 'high',
            message: `吊装路径经过禁区：${zone.name}，请调整路径`,
            timestamp: Date.now(),
          });
          break;
        }
      }
    }
  }
  
  for (const building of buildings) {
    const buildingLeft = building.position.x - building.dimensions.width / 2;
    const buildingRight = building.position.x + building.dimensions.width / 2;
    const buildingFront = building.position.z - building.dimensions.depth / 2;
    const buildingBack = building.position.z + building.dimensions.depth / 2;
    
    if (sliderLiftX >= buildingLeft && sliderLiftX <= buildingRight && 
        sliderLiftZ >= buildingFront && sliderLiftZ <= buildingBack) {
      addUniqueRisk(risks, {
        id: generateId(),
        type: 'collision',
        severity: 'critical',
        message: `碰撞风险！吊臂位置与 ${building.name} 重叠`,
        timestamp: Date.now(),
      });
    }
  }
  
  return risks;
};

const isPositionInZone = (
  position: { x: number; z: number },
  zone: DangerZone
): boolean => {
  if (zone.shape === 'circle' && zone.radius) {
    const dx = position.x - zone.position.x;
    const dz = position.z - zone.position.z;
    return Math.sqrt(dx * dx + dz * dz) <= zone.radius;
  } else if (zone.shape === 'rectangle' && zone.dimensions) {
    const halfWidth = zone.dimensions.width / 2;
    const halfDepth = zone.dimensions.depth / 2;
    return (
      position.x >= zone.position.x - halfWidth &&
      position.x <= zone.position.x + halfWidth &&
      position.z >= zone.position.z - halfDepth &&
      position.z <= zone.position.z + halfDepth
    );
  }
  return false;
};

export const getSeverityColor = (severity: Risk['severity']): string => {
  switch (severity) {
    case 'critical': return '#FF4D4F';
    case 'high': return '#FA8C16';
    case 'medium': return '#FAAD14';
    case 'low': return '#52C41A';
    default: return '#8C8C8C';
  }
};

export const getSeverityLabel = (severity: Risk['severity']): string => {
  switch (severity) {
    case 'critical': return '严重';
    case 'high': return '高';
    case 'medium': return '中';
    case 'low': return '低';
    default: return '未知';
  }
};

export const getRiskTypeLabel = (type: Risk['type']): string => {
  switch (type) {
    case 'radius_exceeded': return '半径超限';
    case 'weight_exceeded': return '重量超限';
    case 'wind_exceeded': return '风速超限';
    case 'zone_occupied': return '警戒区占用';
    case 'collision': return '碰撞风险';
    default: return '未知风险';
  }
};
