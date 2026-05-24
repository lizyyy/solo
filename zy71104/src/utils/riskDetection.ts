import { SceneState, Risk, DangerZone } from '../types';
import { calculateMaxWeightForRadius, getCurrentLiftRadius } from './cranePhysics';

const generateId = () => `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const detectRisks = (state: SceneState): Risk[] => {
  const risks: Risk[] = [];
  const { crane, liftObject, environment, dangerZones, buildings } = state;
  
  const currentRadius = getCurrentLiftRadius(crane, liftObject);
  
  if (currentRadius > crane.maxRadius) {
    risks.push({
      id: generateId(),
      type: 'radius_exceeded',
      severity: 'critical',
      message: `超半径吊装！当前半径 ${currentRadius.toFixed(1)}m 超出最大半径 ${crane.maxRadius}m`,
      timestamp: Date.now(),
    });
  }
  
  if (currentRadius < crane.minRadius) {
    risks.push({
      id: generateId(),
      type: 'radius_exceeded',
      severity: 'high',
      message: `作业半径过小！当前半径 ${currentRadius.toFixed(1)}m 小于最小半径 ${crane.minRadius}m`,
      timestamp: Date.now(),
    });
  }
  
  const maxAllowedWeight = calculateMaxWeightForRadius(crane, currentRadius);
  if (liftObject.weight > maxAllowedWeight) {
    risks.push({
      id: generateId(),
      type: 'weight_exceeded',
      severity: 'critical',
      message: `超重！当前重量 ${liftObject.weight}吨 超过该半径允许最大值 ${maxAllowedWeight.toFixed(1)}吨`,
      timestamp: Date.now(),
    });
  }
  
  if (liftObject.weight > crane.maxWeight) {
    risks.push({
      id: generateId(),
      type: 'weight_exceeded',
      severity: 'critical',
      message: `超重！当前重量 ${liftObject.weight}吨 超过塔吊最大起重量 ${crane.maxWeight}吨`,
      timestamp: Date.now(),
    });
  }
  
  if (environment.windSpeed > environment.maxAllowedWindSpeed) {
    risks.push({
      id: generateId(),
      type: 'wind_exceeded',
      severity: 'high',
      message: `风速超限！当前风速 ${environment.windSpeed}m/s 超过安全值 ${environment.maxAllowedWindSpeed}m/s`,
      timestamp: Date.now(),
    });
  } else if (environment.windSpeed > environment.maxAllowedWindSpeed * 0.8) {
    risks.push({
      id: generateId(),
      type: 'wind_exceeded',
      severity: 'medium',
      message: `风速较高！当前风速 ${environment.windSpeed}m/s，请注意作业安全`,
      timestamp: Date.now(),
    });
  }
  
  const liftProgress = liftObject.currentProgress;
  for (let p = 0; p <= 1; p += 0.1) {
    const testProgress = Math.min(1, liftProgress + p);
    const testLift = { ...liftObject, currentProgress: testProgress };
    const testRadius = getCurrentLiftRadius(crane, testLift);
    
    const angle = Math.atan2(
      liftObject.startPosition.x + testProgress * (liftObject.endPosition.x - liftObject.startPosition.x) - crane.position.x,
      liftObject.startPosition.z + testProgress * (liftObject.endPosition.z - liftObject.startPosition.z) - crane.position.z
    );
    
    const liftX = crane.position.x + testRadius * Math.sin(angle);
    const liftZ = crane.position.z + testRadius * Math.cos(angle);
    
    for (const zone of dangerZones) {
      if (zone.occupied && zone.type === 'restricted') {
        if (isPositionInZone({ x: liftX, z: liftZ }, zone)) {
          risks.push({
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
  
  const liftX2 = crane.position.x + currentRadius * Math.sin((crane.currentAngle * Math.PI) / 180);
  const liftZ2 = crane.position.z + currentRadius * Math.cos((crane.currentAngle * Math.PI) / 180);
  
  for (const building of buildings) {
    const buildingLeft = building.position.x - building.dimensions.width / 2;
    const buildingRight = building.position.x + building.dimensions.width / 2;
    const buildingFront = building.position.z - building.dimensions.depth / 2;
    const buildingBack = building.position.z + building.dimensions.depth / 2;
    
    if (liftX2 >= buildingLeft && liftX2 <= buildingRight && 
        liftZ2 >= buildingFront && liftZ2 <= buildingBack) {
      risks.push({
        id: generateId(),
        type: 'collision',
        severity: 'critical',
        message: `碰撞风险！吊物位置与 ${building.name} 重叠`,
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
