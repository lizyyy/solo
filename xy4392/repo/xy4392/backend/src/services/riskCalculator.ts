import { 
  PlacedLight, 
  Actor, 
  Camera, 
  ScheduleItem, 
  RiskItem,
  StudioDimensions,
  Vec3 
} from '../types';

const SAFE_DISTANCE_HIGH_TEMP = 1.5;
const STAND_RADIUS = 0.3;
const ACTOR_HEIGHT = 1.8;

function distance3D(a: Vec3, b: Vec3): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2) +
    Math.pow(a.z - b.z, 2)
  );
}

function distance2D(a: Vec3, b: Vec3): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.z - b.z, 2)
  );
}

function lineSegmentIntersectsSphere(
  lineStart: Vec3,
  lineEnd: Vec3,
  sphereCenter: Vec3,
  radius: number
): boolean {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const dz = lineEnd.z - lineStart.z;

  const fx = lineStart.x - sphereCenter.x;
  const fy = lineStart.y - sphereCenter.y;
  const fz = lineStart.z - sphereCenter.z;

  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const c = fx * fx + fy * fy + fz * fz - radius * radius;

  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;

  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);

  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);

  return !(e1 <= s2 || e2 <= s1);
}

interface RiskInput {
  lights: PlacedLight[];
  actors: Actor[];
  cameras: Camera[];
  schedule: ScheduleItem[];
  studioDimensions: StudioDimensions;
  maxPowerLimit: number;
}

interface RiskResult {
  id?: string;
  type: RiskItem['type'];
  severity: RiskItem['severity'];
  title: string;
  description: string;
  affectedItems: string[];
}

export function calculateAllRisks(input: RiskInput): RiskResult[] {
  const risks: RiskResult[] = [];

  risks.push(...checkPowerOverload(input.lights, input.maxPowerLimit));
  risks.push(...checkLightStandBlocking(input.lights, input.cameras));
  risks.push(...checkActorNearHighTemp(input.lights, input.actors));
  risks.push(...checkScheduleConflicts(input.schedule));

  return risks;
}

function checkPowerOverload(lights: PlacedLight[], maxPower: number): RiskResult[] {
  const totalPower = lights.reduce((sum, l) => sum + l.power, 0);
  
  if (totalPower > maxPower) {
    return [{
      type: 'power_overload',
      severity: totalPower > maxPower * 1.5 ? 'critical' : 'high',
      title: '功率超载警告',
      description: `总功率 ${totalPower}W 超过限制 ${maxPower}W，超载 ${((totalPower - maxPower) / maxPower * 100).toFixed(1)}%`,
      affectedItems: lights.map(l => l.id)
    }];
  }
  return [];
}

function checkLightStandBlocking(lights: PlacedLight[], cameras: Camera[]): RiskResult[] {
  const risks: RiskResult[] = [];

  for (const camera of cameras) {
    const camPos2D: Vec3 = { x: camera.position.x, y: 0, z: camera.position.z };
    
    for (const light of lights) {
      const lightPos2D: Vec3 = { x: light.position.x, y: 0, z: light.position.z };
      
      if (distance2D(camPos2D, lightPos2D) < 0.5) continue;
      
      const dirX = lightPos2D.x - camPos2D.x;
      const dirZ = lightPos2D.z - camPos2D.z;
      const dotCameraDir = Math.cos(camera.rotation.y) * dirZ + Math.sin(camera.rotation.y) * dirX;
      
      if (dotCameraDir < 0) continue;
      
      const standBottom: Vec3 = { x: light.position.x, y: 0, z: light.position.z };
      const standTop: Vec3 = { x: light.position.x, y: light.standHeight, z: light.position.z };
      
      const camEye: Vec3 = { ...camera.position, y: camera.position.y + 0.5 };
      const lookDir = {
        x: Math.sin(camera.rotation.y),
        y: Math.sin(camera.rotation.x),
        z: Math.cos(camera.rotation.y)
      };
      
      const farPoint: Vec3 = {
        x: camEye.x + lookDir.x * 50,
        y: camEye.y + lookDir.y * 50,
        z: camEye.z + lookDir.z * 50
      };
      
      if (lineSegmentIntersectsCylinder(camEye, farPoint, standBottom, standTop, STAND_RADIUS)) {
        risks.push({
          type: 'light_stand_blocking',
          severity: 'medium',
          title: '灯架可能遮挡镜头',
          description: `灯具 "${light.name}" 的灯架位置可能遮挡相机 "${camera.name}" 的视野`,
          affectedItems: [light.id, camera.id]
        });
      }
    }
  }

  return risks;
}

function lineSegmentIntersectsCylinder(
  lineStart: Vec3,
  lineEnd: Vec3,
  cylBottom: Vec3,
  cylTop: Vec3,
  radius: number
): boolean {
  const axis: Vec3 = {
    x: cylTop.x - cylBottom.x,
    y: cylTop.y - cylBottom.y,
    z: cylTop.z - cylBottom.z
  };
  
  const d: Vec3 = {
    x: lineEnd.x - lineStart.x,
    y: lineEnd.y - lineStart.y,
    z: lineEnd.z - lineStart.z
  };
  
  const w: Vec3 = {
    x: lineStart.x - cylBottom.x,
    y: lineStart.y - cylBottom.y,
    z: lineStart.z - cylBottom.z
  };
  
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
  
  const a = dot(d, d) - dot(d, axis) * dot(d, axis);
  const b = 2 * (dot(d, w) - dot(d, axis) * dot(w, axis));
  const c = dot(w, w) - dot(w, axis) * dot(w, axis) - radius * radius;
  
  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  
  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);
  
  for (const t of [t1, t2]) {
    if (t < 0 || t > 1) continue;
    
    const hitPoint: Vec3 = {
      x: lineStart.x + d.x * t,
      y: lineStart.y + d.y * t,
      z: lineStart.z + d.z * t
    };
    
    const toHit: Vec3 = {
      x: hitPoint.x - cylBottom.x,
      y: hitPoint.y - cylBottom.y,
      z: hitPoint.z - cylBottom.z
    };
    
    const proj = dot(toHit, axis);
    const axisLength = Math.sqrt(dot(axis, axis));
    
    if (proj >= 0 && proj <= axisLength) {
      return true;
    }
  }
  
  return false;
}

function checkActorNearHighTemp(lights: PlacedLight[], actors: Actor[]): RiskResult[] {
  const risks: RiskResult[] = [];
  const highTempLights = lights.filter(l => l.isHighTemp);

  for (const light of highTempLights) {
    for (const actor of actors) {
      const dist = distance2D(light.position, actor.position);
      
      if (dist < SAFE_DISTANCE_HIGH_TEMP) {
        risks.push({
          type: 'actor_near_high_temp',
          severity: dist < SAFE_DISTANCE_HIGH_TEMP * 0.5 ? 'high' : 'medium',
          title: '演员靠近高温灯具',
          description: `演员 "${actor.name}" 距离高温灯具 "${light.name}" 仅有 ${dist.toFixed(2)}m，小于安全距离 ${SAFE_DISTANCE_HIGH_TEMP}m`,
          affectedItems: [actor.id, light.id]
        });
      }
      
      if (actor.walkPath && actor.walkPath.length > 0) {
        const pathPoints = [actor.position, ...actor.walkPath];
        for (let i = 0; i < pathPoints.length - 1; i++) {
          if (lineSegmentIntersectsSphere(
            pathPoints[i],
            pathPoints[i + 1],
            light.position,
            SAFE_DISTANCE_HIGH_TEMP
          )) {
            risks.push({
              type: 'actor_near_high_temp',
              severity: 'medium',
              title: '演员走位路径经过高温灯具附近',
              description: `演员 "${actor.name}" 的走位路径会经过高温灯具 "${light.name}" 的安全距离范围内`,
              affectedItems: [actor.id, light.id]
            });
            break;
          }
        }
      }
    }
  }

  return risks;
}

function checkScheduleConflicts(schedule: ScheduleItem[]): RiskResult[] {
  const risks: RiskResult[] = [];
  const conflicts = new Map<string, Set<string>>();

  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      const a = schedule[i];
      const b = schedule[j];
      
      if (a.date !== b.date) continue;
      if (!timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue;
      
      const commonLights = a.lightIds.filter(id => b.lightIds.includes(id));
      for (const lightId of commonLights) {
        const key = `${lightId}-${a.id}-${b.id}`;
        if (!conflicts.has(key)) {
          conflicts.set(key, new Set([a.id, b.id, lightId]));
          risks.push({
            type: 'light_schedule_conflict',
            severity: 'high',
            title: '灯具场次冲突',
            description: `灯具在场次 "${a.sceneName}" (${a.date} ${a.startTime}-${a.endTime}) 和 "${b.sceneName}" (${b.date} ${b.startTime}-${b.endTime}) 中被同时使用`,
            affectedItems: [lightId, a.id, b.id]
          });
        }
      }
      
      const commonCameras = a.cameraIds.filter(id => b.cameraIds.includes(id));
      for (const camId of commonCameras) {
        const key = `${camId}-${a.id}-${b.id}`;
        if (!conflicts.has(key)) {
          conflicts.set(key, new Set([a.id, b.id, camId]));
          risks.push({
            type: 'light_schedule_conflict',
            severity: 'medium',
            title: '机位场次冲突',
            description: `机位在场次 "${a.sceneName}" 和 "${b.sceneName}" 中被同时使用`,
            affectedItems: [camId, a.id, b.id]
          });
        }
      }
      
      const commonActors = a.actorIds.filter(id => b.actorIds.includes(id));
      for (const actorId of commonActors) {
        const key = `${actorId}-${a.id}-${b.id}`;
        if (!conflicts.has(key)) {
          conflicts.set(key, new Set([a.id, b.id, actorId]));
          risks.push({
            type: 'light_schedule_conflict',
            severity: 'medium',
            title: '演员场次冲突',
            description: `演员在场次 "${a.sceneName}" 和 "${b.sceneName}" 中被同时安排`,
            affectedItems: [actorId, a.id, b.id]
          });
        }
      }
    }
  }

  return risks;
}

export default {
  calculateAllRisks,
  checkPowerOverload,
  checkLightStandBlocking,
  checkActorNearHighTemp,
  checkScheduleConflicts
};
