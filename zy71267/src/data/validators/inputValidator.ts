import type { AcousticDataset, Seat, MaterialFace, AbsorptionData, RayPath } from '../models/acoustic';
import type { Anomaly, AnomalyType } from '../models/anomalies';

let anomalyCounter = 0;

function createAnomaly(
  type: AnomalyType,
  severity: 'low' | 'medium' | 'high',
  title: string,
  description: string,
  affectedIds: string[],
  suggestion: string
): Anomaly {
  return {
    id: `anomaly_${Date.now()}_${anomalyCounter++}`,
    type,
    severity,
    title,
    description,
    affectedIds,
    suggestion,
  };
}

function detectMaterialMissing(
  materialFaces: MaterialFace[],
  absorptionData: AbsorptionData[]
): Anomaly[] {
  const faceIdsWithData = new Set(absorptionData.map((d) => d.faceId));
  const missingFaces = materialFaces.filter((face) => !faceIdsWithData.has(face.id));

  if (missingFaces.length === 0) return [];

  return [
    createAnomaly(
      'material_missing',
      'high',
      '材料吸声率参数缺失',
      `检测到 ${missingFaces.length} 个墙面缺少吸声率数据：${missingFaces.map((f) => f.surfaceName).join(', ')}`,
      missingFaces.map((f) => f.id),
      '请补充缺失频率段的吸声系数数据，或在材质表中补全该行'
    ),
  ];
}

function detectRayTooDense(rayPaths: RayPath[]): Anomaly[] {
  const RAY_DENSITY_THRESHOLD = 5000;
  if (rayPaths.length <= RAY_DENSITY_THRESHOLD) return [];

  return [
    createAnomaly(
      'ray_too_dense',
      'medium',
      '反射路径过密',
      `当前共有 ${rayPaths.length} 条反射路径，超过建议阈值 ${RAY_DENSITY_THRESHOLD} 条，可能影响渲染性能`,
      rayPaths.slice(0, 10).map((r) => r.id),
      '建议启用路径筛选，按反射阶数或能量阈值过滤，或在计算时降低射线密度'
    ),
  ];
}

function detectSeatSamplingError(seats: Seat[], dataset: AcousticDataset): Anomaly[] {
  const { width, height, depth } = dataset.hall.dimensions;
  const { center } = dataset.hall;

  const minX = center.x - width / 2;
  const maxX = center.x + width / 2;
  const minY = center.y;
  const maxY = center.y + height;
  const minZ = center.z - depth / 2;
  const maxZ = center.z + depth / 2;

  const errorSeats = seats.filter((seat) => {
    const { x, y, z } = seat.position;
    return x < minX || x > maxX || y < minY || y > maxY || z < minZ || z > maxZ;
  });

  if (errorSeats.length === 0) return [];

  return [
    createAnomaly(
      'seat_sampling_error',
      'high',
      '座位采样位置错误',
      `检测到 ${errorSeats.length} 个座位位置超出厅堂边界：${errorSeats.map((s) => `${s.row}排${s.number}座`).join(', ')}`,
      errorSeats.map((s) => s.id),
      '请检查座位坐标测量数据，确认是否存在单位换算或坐标系对齐问题'
    ),
  ];
}

function detectSeatNoReading(seats: Seat[], readings: Array<{ seatId: string }>): Anomaly[] {
  const seatIdsWithReading = new Set(readings.map((r) => r.seatId));
  const seatsWithoutReading = seats.filter((seat) => !seatIdsWithReading.has(seat.id));

  if (seatsWithoutReading.length === 0) return [];

  return [
    createAnomaly(
      'seat_no_reading',
      'medium',
      '座位缺少声学读数',
      `检测到 ${seatsWithoutReading.length} 个座位没有关联的声学参数读数`,
      seatsWithoutReading.map((s) => s.id),
      '请检查声场模拟结果，确认这些座位是否在计算范围内'
    ),
  ];
}

function detectEnergyDecayError(rayPaths: RayPath[]): Anomaly[] {
  const orderEnergyMap = new Map<number, number[]>();

  rayPaths.forEach((ray) => {
    if (!orderEnergyMap.has(ray.order)) {
      orderEnergyMap.set(ray.order, []);
    }
    orderEnergyMap.get(ray.order)!.push(ray.energy);
  });

  const orders = Array.from(orderEnergyMap.keys()).sort((a, b) => a - b);
  const avgEnergies = orders.map((order) => {
    const energies = orderEnergyMap.get(order)!;
    return energies.reduce((sum, e) => sum + e, 0) / energies.length;
  });

  const anomalyRays: string[] = [];
  for (let i = 1; i < avgEnergies.length; i++) {
    if (avgEnergies[i] > avgEnergies[i - 1]) {
      const anomalyOrder = orders[i];
      rayPaths
        .filter((r) => r.order === anomalyOrder && r.energy > avgEnergies[i - 1])
        .slice(0, 5)
        .forEach((r) => anomalyRays.push(r.id));
    }
  }

  if (anomalyRays.length === 0) return [];

  return [
    createAnomaly(
      'energy_decay_error',
      'high',
      '能量衰减规律异常',
      '检测到部分高阶反射路径能量高于低阶路径，不符合物理衰减规律',
      anomalyRays,
      '请检查声学模拟计算参数，确认能量衰减模型配置是否正确'
    ),
  ];
}

export function validateDataset(dataset: AcousticDataset): Anomaly[] {
  anomalyCounter = 0;
  const anomalies: Anomaly[] = [];

  anomalies.push(...detectMaterialMissing(dataset.materialFaces, dataset.absorptionData));
  anomalies.push(...detectRayTooDense(dataset.rayPaths));
  anomalies.push(...detectSeatSamplingError(dataset.seats, dataset));
  anomalies.push(...detectSeatNoReading(dataset.seats, dataset.acousticReadings));
  anomalies.push(...detectEnergyDecayError(dataset.rayPaths));

  return anomalies;
}

export function getAnomalyStats(anomalies: Anomaly[]) {
  return {
    total: anomalies.length,
    high: anomalies.filter((a) => a.severity === 'high').length,
    medium: anomalies.filter((a) => a.severity === 'medium').length,
    low: anomalies.filter((a) => a.severity === 'low').length,
  };
}
