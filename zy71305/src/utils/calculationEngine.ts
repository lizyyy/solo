import {
  HoistPoint,
  Equipment,
  CableSpec,
  CalculationParams,
  CheckResultItem,
  HoistPointResult,
  VerificationReport,
} from '../types';

export const ANGLE_MIN = 15;
export const ANGLE_MAX = 90;
export const SAFETY_FACTOR_MIN = 3;
export const SAFETY_FACTOR_RECOMMENDED = 5;
export const WEIGHT_TOLERANCE = 0.01;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculatePointWeight(
  pointId: string,
  equipmentList: Equipment[]
): number {
  return equipmentList
    .filter((e) => e.assignedPointId === pointId)
    .reduce((sum, e) => sum + e.weight * e.quantity, 0);
}

export function calculateForces(
  totalWeightKg: number,
  angleDegrees: number | null,
  numPoints: number,
  gravity: number
): {
  verticalForce: number;
  horizontalForce: number;
  cableForce: number;
} {
  if (angleDegrees === null || numPoints === 0) {
    return { verticalForce: 0, horizontalForce: 0, cableForce: 0 };
  }

  const totalWeightKN = (totalWeightKg * gravity) / 1000;
  const verticalForcePerPoint = totalWeightKN / numPoints;

  const angleRad = toRadians(angleDegrees);
  const sinAngle = Math.sin(angleRad);
  const cosAngle = Math.cos(angleRad);

  if (sinAngle === 0) {
    return { verticalForce: verticalForcePerPoint, horizontalForce: 0, cableForce: 0 };
  }

  const cableForce = verticalForcePerPoint / sinAngle;
  const horizontalForce = cableForce * cosAngle;

  return {
    verticalForce: verticalForcePerPoint,
    horizontalForce,
    cableForce,
  };
}

export function calculateSafetyRatio(
  cableForce: number,
  breakingLoad: number
): number {
  if (cableForce <= 0) return Infinity;
  return breakingLoad / cableForce;
}

export function checkAngles(points: HoistPoint[]): CheckResultItem[] {
  const results: CheckResultItem[] = [];

  points.forEach((point) => {
    if (point.angle === null) {
      results.push({
        type: 'angle',
        status: 'error',
        message: `${point.name} 未设置吊装角度`,
        location: point.name,
        suggestion: '请设置吊装角度，建议范围30°~60°，最小不低于15°',
      });
    } else if (point.angle < ANGLE_MIN) {
      results.push({
        type: 'angle',
        status: 'error',
        message: `${point.name} 角度 ${point.angle}° 低于最小值 ${ANGLE_MIN}°`,
        location: point.name,
        suggestion: `请增大吊装角度至${ANGLE_MIN}°以上，避免水平分力过大`,
      });
    } else if (point.angle > ANGLE_MAX) {
      results.push({
        type: 'angle',
        status: 'warning',
        message: `${point.name} 角度 ${point.angle}° 超出建议范围`,
        location: point.name,
        suggestion: '角度过大接近垂直吊装，需确认实际安装情况',
      });
    } else if (point.angle < 30) {
      results.push({
        type: 'angle',
        status: 'warning',
        message: `${point.name} 角度 ${point.angle}° 偏小，水平分力较大`,
        location: point.name,
        suggestion: '建议吊装角度在30°~60°之间，以平衡钢丝绳受力和水平分力',
      });
    }
  });

  if (results.length === 0) {
    results.push({
      type: 'angle',
      status: 'pass',
      message: '所有吊点角度设置正常',
      suggestion: '继续保持合理的吊装角度设置',
    });
  }

  return results;
}

export function checkWeights(equipmentList: Equipment[]): CheckResultItem[] {
  const results: CheckResultItem[] = [];

  const nameGroups: Record<string, Equipment[]> = {};
  equipmentList.forEach((eq) => {
    const key = eq.name.trim().toLowerCase();
    if (!nameGroups[key]) nameGroups[key] = [];
    nameGroups[key].push(eq);
  });

  Object.entries(nameGroups).forEach(([name, items]) => {
    if (items.length > 1) {
      const totalWeight = items.reduce((sum, i) => sum + i.weight * i.quantity, 0);
      results.push({
        type: 'weight',
        status: 'warning',
        message: `发现重复设备 "${items[0].name}"，共 ${items.length} 条记录`,
        location: items.map((i) => i.name).join(', '),
        suggestion: `请确认是否需要合并。当前累计重量: ${totalWeight.toFixed(2)} kg`,
      });
    }
  });

  equipmentList.forEach((eq) => {
    if (eq.weight <= 0) {
      results.push({
        type: 'weight',
        status: 'error',
        message: `${eq.name} 重量设置异常 (${eq.weight} kg)`,
        location: eq.name,
        suggestion: '请输入正确的设备重量，重量必须大于0',
      });
    }
    if (eq.quantity <= 0 || !Number.isInteger(eq.quantity)) {
      results.push({
        type: 'weight',
        status: 'error',
        message: `${eq.name} 数量设置异常 (${eq.quantity})`,
        location: eq.name,
        suggestion: '请输入正确的设备数量，数量必须是正整数',
      });
    }
  });

  const unassigned = equipmentList.filter((e) => !e.assignedPointId);
  if (unassigned.length > 0) {
    results.push({
      type: 'weight',
      status: 'warning',
      message: `${unassigned.length} 台设备未分配吊点`,
      location: unassigned.map((e) => e.name).join(', '),
      suggestion: '请将所有设备分配到对应的吊点进行计算',
    });
  }

  if (results.length === 0) {
    results.push({
      type: 'weight',
      status: 'pass',
      message: '所有设备重量和数量设置正常',
      suggestion: '继续保持完整的设备清单管理',
    });
  }

  return results;
}

export function checkSafetyFactor(params: CalculationParams): CheckResultItem[] {
  const results: CheckResultItem[] = [];

  if (params.safetyFactor < SAFETY_FACTOR_MIN) {
    results.push({
      type: 'factor',
      status: 'error',
      message: `安全系数 ${params.safetyFactor} 低于最低要求 ${SAFETY_FACTOR_MIN}`,
      location: '全局设置',
      suggestion: `剧场吊装作业安全系数不得低于 ${SAFETY_FACTOR_MIN}，建议设置为 ${SAFETY_FACTOR_RECOMMENDED} 或以上`,
    });
  } else if (params.safetyFactor < SAFETY_FACTOR_RECOMMENDED) {
    results.push({
      type: 'factor',
      status: 'warning',
      message: `安全系数 ${params.safetyFactor} 低于推荐值 ${SAFETY_FACTOR_RECOMMENDED}`,
      location: '全局设置',
      suggestion: `建议将安全系数提高至 ${SAFETY_FACTOR_RECOMMENDED} 以确保足够的安全余量`,
    });
  } else {
    results.push({
      type: 'factor',
      status: 'pass',
      message: `安全系数 ${params.safetyFactor} 符合要求`,
      suggestion: '安全系数设置合理，可有效应对意外载荷',
    });
  }

  return results;
}

export function checkCableCapacity(
  pointResults: HoistPointResult[],
  cableSpec: CableSpec
): CheckResultItem[] {
  const results: CheckResultItem[] = [];

  pointResults.forEach((result) => {
    if (result.cableForce > 0 && result.safetyRatio < SAFETY_FACTOR_MIN) {
      results.push({
        type: 'cable',
        status: 'error',
        message: `${result.pointName} 钢丝绳安全系数不足 (实际: ${result.safetyRatio.toFixed(2)})`,
        location: result.pointName,
        suggestion: '请选择更大规格的钢丝绳或减少该吊点的载荷重量',
      });
    } else if (result.cableForce > 0 && result.safetyRatio < SAFETY_FACTOR_RECOMMENDED) {
      results.push({
        type: 'cable',
        status: 'warning',
        message: `${result.pointName} 钢丝绳安全系数余量偏低 (实际: ${result.safetyRatio.toFixed(2)})`,
        location: result.pointName,
        suggestion: '考虑增加安全余量，确保长期使用的可靠性',
      });
    }
  });

  if (results.length === 0 && pointResults.length > 0) {
    results.push({
      type: 'cable',
      status: 'pass',
      message: `所有吊点钢丝绳承载力满足要求 (${cableSpec.diameter}mm, 破断载荷: ${cableSpec.breakingLoad}kN)`,
      suggestion: '定期检查钢丝绳磨损情况，确保安全使用',
    });
  }

  return results;
}

export function calculatePointResults(
  points: HoistPoint[],
  equipmentList: Equipment[],
  cableSpec: CableSpec,
  params: CalculationParams
): HoistPointResult[] {
  return points.map((point) => {
    const totalWeight = calculatePointWeight(point.id, equipmentList);
    const forces = calculateForces(
      totalWeight,
      point.angle,
      1,
      params.gravity
    );
    const safetyRatio = calculateSafetyRatio(forces.cableForce, cableSpec.breakingLoad);
    const isSafe = safetyRatio >= params.safetyFactor;

    return {
      pointId: point.id,
      pointName: point.name,
      x: point.x,
      y: point.y,
      z: point.z,
      angle: point.angle,
      totalWeight,
      verticalForce: forces.verticalForce,
      horizontalForce: forces.horizontalForce,
      cableForce: forces.cableForce,
      safetyRatio,
      isSafe,
    };
  });
}

export function generateVerificationReport(
  points: HoistPoint[],
  equipmentList: Equipment[],
  cableSpec: CableSpec,
  params: CalculationParams
): VerificationReport {
  const pointResults = calculatePointResults(points, equipmentList, cableSpec, params);

  const angleChecks = checkAngles(points);
  const weightChecks = checkWeights(equipmentList);
  const factorChecks = checkSafetyFactor(params);
  const cableChecks = checkCableCapacity(pointResults, cableSpec);

  const checkResults = [...angleChecks, ...weightChecks, ...factorChecks, ...cableChecks];

  const totalWeight = equipmentList.reduce(
    (sum, e) => sum + e.weight * e.quantity,
    0
  );

  const validResults = pointResults.filter((r) => r.cableForce > 0);
  const maxCableForce = validResults.length > 0
    ? Math.max(...validResults.map((r) => r.cableForce))
    : 0;
  const minSafetyRatio = validResults.length > 0
    ? Math.min(...validResults.map((r) => r.safetyRatio))
    : Infinity;

  const hasError = checkResults.some((r) => r.status === 'error');
  const hasWarning = checkResults.some((r) => r.status === 'warning');
  const overallStatus = hasError ? 'danger' : hasWarning ? 'warning' : 'safe';

  return {
    summary: {
      totalPoints: points.length,
      totalEquipment: equipmentList.reduce((sum, e) => sum + e.quantity, 0),
      totalWeight,
      maxCableForce,
      minSafetyRatio: minSafetyRatio === Infinity ? 0 : minSafetyRatio,
      overallStatus,
    },
    checkResults,
    pointResults,
    equipmentList,
    cableSpec,
    params,
    generatedAt: new Date().toISOString(),
    version: '1.0',
  };
}
