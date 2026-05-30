import type { BlackHole, LightRay, Star, QualityReport, QualityIssue, Vec3 } from '../types';
import { calculateSchwarzschildRadius } from '../physics/constants';

const vec3 = {
  distance: (a: Vec3, b: Vec3): number => {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },
  length: (v: Vec3): number => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
};

export interface QualityCheckParams {
  blackHole: BlackHole;
  lightRays: LightRay[];
  stars: Star[];
  cameraPosition: Vec3;
  rayCount: number;
  starDensity: number;
}

export const checkScaleConsistency = (params: QualityCheckParams): QualityIssue | null => {
  const { blackHole, lightRays, cameraPosition } = params;
  const rs = calculateSchwarzschildRadius(blackHole.mass);
  const cameraDist = vec3.distance(cameraPosition, [0, 0, 0]);

  if (rs < 0.001 || rs > 100) {
    const affectedRays = lightRays
      .filter(ray => ray.impactParameter < rs * 2 || ray.impactParameter > rs * 10)
      .map(ray => ray.id);

    const severity = rs < 0.001 || rs > 50 ? 'high' : 'medium';
    const humanReason = rs < 0.001
      ? `当前黑洞质量 ${blackHole.mass.toExponential(2)} 太阳质量对应的史瓦西半径过小（${rs.toExponential(2)} 单位），可能导致光线计算精度丢失，尤其是碰撞参数接近临界值的光线。`
      : `当前黑洞质量 ${blackHole.mass.toExponential(2)} 太阳质量对应的史瓦西半径过大（${rs.toFixed(2)} 单位），可能超出可视化范围，相机距离（${cameraDist.toFixed(1)}）可能不足以完整观测引力透镜效应。`;

    return {
      type: 'scale',
      severity,
      description: `史瓦西尺度异常：R_s = ${rs.toExponential(2)}，建议范围 0.01-50`,
      humanReason,
      affectedIds: affectedRays,
    };
  }

  if (cameraDist < rs * 3) {
    return {
      type: 'scale',
      severity: 'medium',
      description: `观测距离过近：相机距离 ${cameraDist.toFixed(1)} < 3R_s (${(rs * 3).toFixed(1)})`,
      humanReason: `相机距离黑洞太近（仅 ${cameraDist.toFixed(1)} 单位，小于3倍史瓦西半径），这会导致看到的引力透镜效果被极度扭曲，不适合教学演示。建议拉远到 ${(rs * 10).toFixed(1)} 单位以上。`,
      affectedIds: lightRays.map(r => r.id),
    };
  }

  return null;
};

export const checkRayPenetration = (params: QualityCheckParams): QualityIssue | null => {
  const { blackHole, lightRays } = params;
  const rs = calculateSchwarzschildRadius(blackHole.mass);
  const penetratedRays: string[] = [];

  lightRays.forEach(ray => {
    if ((ray.pathType as string) === 'captured') return;

    for (let i = 0; i < ray.pathPoints.length - 1; i++) {
      const p1 = ray.pathPoints[i] as Vec3;
      const p2 = ray.pathPoints[i + 1] as Vec3;
      const d1 = vec3.length(p1);
      const d2 = vec3.length(p2);

      if ((d1 > rs && d2 < rs * 0.99) || (d1 < rs * 0.99 && d2 > rs)) {
        if ((ray.pathType as string) !== 'captured') {
          penetratedRays.push(ray.id);
          break;
        }
      }
    }
  });

  if (penetratedRays.length > 0) {
    return {
      type: 'penetration',
      severity: penetratedRays.length > 5 ? 'high' : 'medium',
      description: `${penetratedRays.length} 条光线穿模，穿过了事件视界但未被标记为捕获`,
      humanReason: `检测到 ${penetratedRays.length} 条光线在数值积分中意外穿过了事件视界但未被正确标记为"被捕获"。这通常发生在步长过大或碰撞参数非常接近临界值时。建议增加光线追踪的步数或减小步长以提高精度。受影响的光线ID已列出，方便您检查具体路径。`,
      affectedIds: penetratedRays,
    };
  }

  return null;
};

export const checkStarOcclusion = (params: QualityCheckParams): QualityIssue | null => {
  const { blackHole, stars, cameraPosition } = params;
  const rs = calculateSchwarzschildRadius(blackHole.mass);
  const occludedStars: string[] = [];
  const nearStars: string[] = [];

  stars.forEach(star => {
    const starPos = star.position;
    const toStar = [
      starPos[0] - cameraPosition[0],
      starPos[1] - cameraPosition[1],
      starPos[2] - cameraPosition[2],
    ] as Vec3;
    const toBH = [
      0 - cameraPosition[0],
      0 - cameraPosition[1],
      0 - cameraPosition[2],
    ] as Vec3;

    const starDist = vec3.length(toStar);
    const bhDist = vec3.length(toBH);

    const dot = toStar[0] * toBH[0] + toStar[1] * toBH[1] + toStar[2] * toBH[2];
    const cosAngle = dot / (starDist * bhDist);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    const angularSeparation = angle * (180 / Math.PI);

    if (angularSeparation < 2 && starDist > bhDist) {
      occludedStars.push(star.id);
    } else if (angularSeparation < 5 && starDist > bhDist) {
      nearStars.push(star.id);
    }
  });

  if (occludedStars.length > 0 || nearStars.length > 0) {
    const severity = occludedStars.length > 10 ? 'high' : occludedStars.length > 0 ? 'medium' : 'low';
    const description = occludedStars.length > 0
      ? `${occludedStars.length} 颗恒星被黑洞遮挡，${nearStars.length} 颗位于临界区域`
      : `${nearStars.length} 颗恒星接近黑洞视线方向，可能产生强引力透镜`;

    const humanReason = occludedStars.length > 0
      ? `从当前视角观察，有 ${occludedStars.length} 颗恒星正好位于黑洞正后方，被黑洞的阴影完全遮挡。另外 ${nearStars.length} 颗恒星位于临界区域，它们的光线会被强烈偏折，可能形成爱因斯坦环或多个像。这些遮挡效应是引力透镜的重要观测特征，但在教学演示中可能需要调整视角以获得更好的可视化效果。`
      : `有 ${nearStars.length} 颗恒星位于黑洞附近的视线方向上（<5度）。这些恒星会表现出明显的引力透镜效应，包括位置偏移和亮度增强。您可以点击这些星点查看具体的透镜放大率。`;

    return {
      type: 'occlusion',
      severity,
      description,
      humanReason,
      affectedIds: [...occludedStars, ...nearStars],
    };
  }

  return null;
};

export const runFullQualityCheck = (params: QualityCheckParams): QualityReport => {
  const issues: QualityIssue[] = [];

  const scaleIssue = checkScaleConsistency(params);
  if (scaleIssue) issues.push(scaleIssue);

  const penetrationIssue = checkRayPenetration(params);
  if (penetrationIssue) issues.push(penetrationIssue);

  const occlusionIssue = checkStarOcclusion(params);
  if (occlusionIssue) issues.push(occlusionIssue);

  let overallStatus: 'pass' | 'warning' | 'error' = 'pass';
  if (issues.some(i => i.severity === 'high')) overallStatus = 'error';
  else if (issues.some(i => i.severity === 'medium')) overallStatus = 'warning';

  return {
    id: `qr-${Date.now()}`,
    timestamp: new Date(),
    issues,
    overallStatus,
  };
};

export const generateQualitySummary = (report: QualityReport): string => {
  if (report.issues.length === 0) {
    return '当前模拟参数在尺度一致性、光线追踪和恒星可见性方面均未检测到明显问题，适合用于教学演示。';
  }

  const highCount = report.issues.filter(i => i.severity === 'high').length;
  const mediumCount = report.issues.filter(i => i.severity === 'medium').length;
  const lowCount = report.issues.filter(i => i.severity === 'low').length;

  return `检测到 ${highCount} 个严重问题、${mediumCount} 个中等问题和 ${lowCount} 个轻微问题。${highCount > 0 ? '建议先解决严重问题再用于正式教学。' : '总体可用，但请注意标注的警告事项。'}`;
};
