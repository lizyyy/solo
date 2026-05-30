import type {
  DroneParams,
  WindData,
  PayloadData,
  BatteryStatus,
  Waypoint,
  RiskItem,
  CalculationResult,
} from '@/types';

function calculateAirDensity(altitude: number): number {
  const temperatureLapse = 0.0065;
  const seaLevelTemp = 288.15;
  const seaLevelDensity = 1.225;
  const exponent = 4.256;

  return seaLevelDensity * Math.pow(1 - (temperatureLapse * altitude) / seaLevelTemp, exponent);
}

function calculateHeadwindComponent(
  windSpeed: number,
  windDirection: number,
  flightDirection: number
): number {
  const angleDiff = Math.abs(flightDirection - windDirection);
  const angleRad = (angleDiff * Math.PI) / 180;
  return windSpeed * Math.cos(angleRad);
}

function calculateBasePower(drone: DroneParams): number {
  const batteryEnergy = (drone.batteryVoltage * drone.batteryCapacity) / 1000;
  const flightTimeHours = drone.maxFlightTime / 60;
  return batteryEnergy / flightTimeHours;
}

function calculatePayloadImpact(
  drone: DroneParams,
  payload: PayloadData
): number {
  const totalWeight = drone.emptyWeight + payload.totalWeight;
  const weightRatio = (totalWeight - drone.emptyWeight) / drone.maxTakeoffWeight;
  return 1 + weightRatio * 0.5;
}

function calculateDragForce(
  airDensity: number,
  headwindComponent: number,
  frontalArea: number,
  dragCoefficient: number
): number {
  const relativeSpeed = Math.abs(headwindComponent);
  return 0.5 * airDensity * relativeSpeed * relativeSpeed * frontalArea * dragCoefficient;
}

function calculateDragPower(
  dragForce: number,
  cruiseSpeed: number,
  headwindComponent: number
): number {
  return dragForce * (cruiseSpeed + Math.max(0, headwindComponent));
}

function calculateWindResistanceImpact(
  dragPower: number,
  basePower: number
): number {
  return 1 + dragPower / basePower;
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadius = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function calculateTotalDistance(waypoints: Waypoint[]): number {
  if (waypoints.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDistance += calculateDistance(
      waypoints[i].lat,
      waypoints[i].lng,
      waypoints[i + 1].lat,
      waypoints[i + 1].lng
    );
  }
  return totalDistance;
}

function calculateReturnDistance(waypoints: Waypoint[]): number {
  if (waypoints.length < 2) return 0;

  const firstPoint = waypoints[0];
  const lastPoint = waypoints[waypoints.length - 1];

  return calculateDistance(
    lastPoint.lat,
    lastPoint.lng,
    firstPoint.lat,
    firstPoint.lng
  );
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function calculateRisks(
  drone: DroneParams,
  wind: WindData,
  payload: PayloadData,
  battery: BatteryStatus,
  result: CalculationResult
): RiskItem[] {
  const risks: RiskItem[] = [];

  if (result.remainingBatteryMargin < 0) {
    risks.push({
      id: generateId(),
      level: 'critical',
      category: 'battery',
      title: '返航电量余量为负',
      description: `返航所需电量超过当前可用电量，余量为 ${result.remainingBatteryMargin.toFixed(1)}%。执行此任务将无法安全返航。`,
      source: '返航阈值计算',
      formula: '电量余量 = 当前电量 - 返航阈值',
      suggestion: '减少航点数量、降低飞行高度、减轻载重或等待电池充满后再执行任务。',
    });
  } else if (result.remainingBatteryMargin < 10) {
    risks.push({
      id: generateId(),
      level: 'warning',
      category: 'battery',
      title: '返航电量余量不足',
      description: `返航电量余量仅为 ${result.remainingBatteryMargin.toFixed(1)}%，安全余量较低。`,
      source: '返航阈值计算',
      formula: '电量余量 = 当前电量 - 返航阈值',
      suggestion: '建议缩短航程或增加安全余量系数。',
    });
  }

  if (wind.speed > 10) {
    risks.push({
      id: generateId(),
      level: 'critical',
      category: 'wind',
      title: '风速过高',
      description: `当前风速 ${wind.speed} m/s 已达到无人机抗风极限，飞行风险极高。`,
      source: '风速数据',
      suggestion: '建议取消任务或等待风速降低后再执行。',
    });
  } else if (wind.speed > 7) {
    risks.push({
      id: generateId(),
      level: 'warning',
      category: 'wind',
      title: '风速较大',
      description: `当前风速 ${wind.speed} m/s，风阻对续航影响显著。`,
      source: '风阻修正计算',
      formula: `风阻影响系数: ${result.windResistanceImpact.toFixed(2)}x`,
      suggestion: '调整飞行方向以减少逆风影响，或降低飞行速度。',
    });
  }

  if (result.headwindComponent > 5) {
    risks.push({
      id: generateId(),
      level: 'warning',
      category: 'wind',
      title: '逆风分量大',
      description: `逆风分量达 ${result.headwindComponent.toFixed(1)} m/s，将大幅增加能耗。`,
      source: '风向分析',
      formula: '逆风分量 = 风速 × cos(|飞行方向 - 风向|)',
      suggestion: '考虑调整航线以避开逆风区域。',
    });
  }

  const totalWeight = drone.emptyWeight + payload.totalWeight;
  if (totalWeight > drone.maxTakeoffWeight * 0.95) {
    risks.push({
      id: generateId(),
      level: 'critical',
      category: 'payload',
      title: '载重接近上限',
      description: `总重量 ${totalWeight}g 已达最大起飞重量的 ${((totalWeight / drone.maxTakeoffWeight) * 100).toFixed(0)}%，严重影响续航。`,
      source: '载重校验',
      suggestion: '立即减轻载重，确保起飞重量在安全范围内。',
    });
  } else if (totalWeight > drone.maxTakeoffWeight * 0.85) {
    risks.push({
      id: generateId(),
      level: 'warning',
      category: 'payload',
      title: '载重较大',
      description: `总重量 ${totalWeight}g 占最大起飞重量的 ${((totalWeight / drone.maxTakeoffWeight) * 100).toFixed(0)}%。`,
      source: '载重能耗估算',
      formula: `载重影响系数: ${result.payloadEnergyImpact.toFixed(2)}x`,
      suggestion: '评估是否可减少非必要设备以减轻重量。',
    });
  }

  if (battery.health < 80) {
    risks.push({
      id: generateId(),
      level: 'warning',
      category: 'battery',
      title: '电池健康度较低',
      description: `电池健康度仅为 ${battery.health}%，实际容量可能低于标称值。`,
      source: '电池状态检测',
      suggestion: '建议更换新电池以确保飞行安全。',
    });
  }

  if (battery.cycleCount > 200) {
    risks.push({
      id: generateId(),
      level: 'notice',
      category: 'battery',
      title: '电池循环次数较多',
      description: `电池已循环 ${battery.cycleCount} 次，性能可能有所衰减。`,
      source: '电池状态检测',
      suggestion: '建议密切关注电池性能，必要时进行更换。',
    });
  }

  if (battery.temperature > 40 || battery.temperature < 0) {
    risks.push({
      id: generateId(),
      level: 'warning',
      category: 'battery',
      title: '电池温度异常',
      description: `电池温度 ${battery.temperature}°C 不在最佳工作范围 (0-40°C)。`,
      source: '电池状态检测',
      suggestion: '待电池温度恢复正常后再起飞。',
    });
  }

  return risks;
}

export function calculateConfidenceScore(
  risks: RiskItem[],
  dataQuality: number
): number {
  let score = dataQuality;

  risks.forEach((risk) => {
    if (risk.level === 'critical') {
      score -= 30;
    } else if (risk.level === 'warning') {
      score -= 10;
    } else {
      score -= 3;
    }
  });

  return Math.max(0, Math.min(100, score));
}

export interface CalculationConfig {
  conservativeFactor: number;
  safetyMargin: number;
}

export function calculateFlightEndurance(
  drone: DroneParams,
  wind: WindData,
  payload: PayloadData,
  battery: BatteryStatus,
  waypoints: Waypoint[],
  config: CalculationConfig
): CalculationResult {
  const basePower = calculateBasePower(drone);
  const payloadImpact = calculatePayloadImpact(drone, payload);
  const airDensity = calculateAirDensity(wind.altitude);
  const headwindComponent = calculateHeadwindComponent(
    wind.speed,
    wind.direction,
    wind.flightDirection
  );
  const dragForce = calculateDragForce(
    airDensity,
    headwindComponent,
    drone.frontalArea,
    drone.dragCoefficient
  );
  const dragPower = calculateDragPower(dragForce, drone.cruiseSpeed, headwindComponent);
  const windResistanceImpact = calculateWindResistanceImpact(dragPower, basePower);

  const totalImpact = payloadImpact * windResistanceImpact * config.conservativeFactor;
  const effectivePower = basePower * totalImpact;
  const batteryEnergy = (drone.batteryVoltage * drone.batteryCapacity * (battery.health / 100)) / 1000;
  const usableEnergy = batteryEnergy * (battery.currentCapacity / 100);

  const estimatedFlightTime = (usableEnergy / effectivePower) * 60;
  const estimatedRange = (drone.cruiseSpeed * estimatedFlightTime * 60) / 1000;

  const totalDistance = calculateTotalDistance(waypoints);
  const returnDistance = calculateReturnDistance(waypoints);
  const totalMissionDistance = totalDistance + returnDistance;

  const returnBatteryRatio = returnDistance / (estimatedRange * 1000) * 100;
  const returnBatteryThreshold = returnBatteryRatio + config.safetyMargin;

  const missionEnergyRatio = totalMissionDistance / (estimatedRange * 1000);
  const remainingBatteryMargin = battery.currentCapacity - missionEnergyRatio * 100 - config.safetyMargin;

  const baseEnergyConsumption = effectivePower * (estimatedFlightTime / 60);

  const partialResult: CalculationResult = {
    id: generateId(),
    timestamp: Date.now(),
    droneParams: drone,
    windData: wind,
    payloadData: payload,
    batteryStatus: battery,
    waypoints: waypoints,

    baseEnergyConsumption,
    basePower,
    payloadEnergyImpact: payloadImpact,
    windResistanceImpact,

    dragForce,
    dragPower,
    headwindComponent,
    airDensity,

    estimatedFlightTime,
    estimatedRange,
    returnBatteryThreshold,
    remainingBatteryMargin,
    totalDistance: totalDistance / 1000,
    returnDistance: returnDistance / 1000,

    risks: [],
    confidenceScore: 0,
  };

  const risks = calculateRisks(drone, wind, payload, battery, partialResult);
  const confidenceScore = calculateConfidenceScore(risks, 95);

  return {
    ...partialResult,
    risks,
    confidenceScore,
  };
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}小时${mins}分钟`;
  }
  return `${mins}分钟`;
}

export function formatDistance(km: number): string {
  if (km >= 1) {
    return `${km.toFixed(2)} km`;
  }
  return `${(km * 1000).toFixed(0)} m`;
}
