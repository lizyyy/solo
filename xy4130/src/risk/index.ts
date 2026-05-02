import type {
  StageProject,
  Risk,
  Vector3,
  LightFixture,
  Actor,
  Rig,
} from '@/types';
import {
  interpolateKeyframes,
  interpolateSimpleKeyframes,
  degToRad,
  distance3D,
  generateUUID,
} from '@/utils/math';

export interface EvaluationContext {
  project: StageProject;
  time: number;
}

export interface LightState {
  position: Vector3;
  pan: number;
  tilt: number;
  intensity: number;
  beamAngle: number;
  lightId: string;
}

export interface ActorState {
  actorId: string;
  position: Vector3;
  height: number;
  radius: number;
}

export interface RigState {
  rigId: string;
  position: Vector3;
  height: number;
  length: number;
  width: number;
}

function getLightState(context: EvaluationContext, light: LightFixture): LightState {
  const rig = context.project.rigs.find((r) => r.id === light.rigId);
  if (!rig) {
    return {
      position: { x: 0, y: 0, z: 0 },
      pan: light.pan,
      tilt: light.tilt,
      intensity: light.intensity,
      beamAngle: light.type.beamAngle,
      lightId: light.id,
    };
  }

  const rigTimeline = context.project.rigTimelines.find((t) => t.rigId === rig.id);
  let rigHeight = rig.currentHeight;
  if (rigTimeline && rigTimeline.keyframes.length > 0) {
    rigHeight = interpolateSimpleKeyframes(rigTimeline.keyframes, context.time, 'height');
  }

  const lightTimeline = context.project.lightTimelines.find((t) => t.lightId === light.id);
  let pan = light.pan;
  let tilt = light.tilt;
  let intensity = light.intensity;

  if (lightTimeline && lightTimeline.keyframes.length > 0) {
    const kfs = lightTimeline.keyframes;
    const latestBeforeTime = kfs.filter((k) => k.time <= context.time).pop();
    if (latestBeforeTime) {
      if (latestBeforeTime.pan !== undefined) pan = latestBeforeTime.pan;
      if (latestBeforeTime.tilt !== undefined) tilt = latestBeforeTime.tilt;
      if (latestBeforeTime.intensity !== undefined) intensity = latestBeforeTime.intensity;
    }
  }

  const lightX = rig.position.x + (light.positionOnRig / rig.length) * rig.length - rig.length / 2;

  return {
    position: { x: lightX, y: rigHeight, z: rig.position.z },
    pan,
    tilt,
    intensity,
    beamAngle: light.type.beamAngle,
    lightId: light.id,
  };
}

function getActorState(context: EvaluationContext, actor: Actor): ActorState {
  const timeline = context.project.actorTimelines.find((t) => t.actorId === actor.id);
  if (!timeline || timeline.keyframes.length === 0) {
    return {
      actorId: actor.id,
      position: { x: 0, y: 0, z: 0 },
      height: actor.height,
      radius: actor.radius,
    };
  }

  const state = interpolateKeyframes(timeline.keyframes, context.time);
  return {
    actorId: actor.id,
    position: { x: state.x, y: state.y, z: state.z },
    height: actor.height,
    radius: actor.radius,
  };
}

function getRigState(context: EvaluationContext, rig: Rig): RigState {
  const timeline = context.project.rigTimelines.find((t) => t.rigId === rig.id);
  let height = rig.currentHeight;

  if (timeline && timeline.keyframes.length > 0) {
    height = interpolateSimpleKeyframes(timeline.keyframes, context.time, 'height');
  }

  return {
    rigId: rig.id,
    position: { ...rig.position },
    height,
    length: rig.length,
    width: rig.width,
  };
}

function checkCollisions(context: EvaluationContext): Risk[] {
  const risks: Risk[] = [];
  const { project, time } = context;

  const lightStates = project.lights.map((l) => getLightState(context, l));
  const actorStates = project.actors.map((a) => getActorState(context, a));
  const rigStates = project.rigs.map((r) => getRigState(context, r));

  for (const light of lightStates) {
    for (const actor of actorStates) {
      const actorTop = {
        x: actor.position.x,
        y: actor.position.y + actor.height,
        z: actor.position.z,
      };

      const lightPos = light.position;

      const lightDir = calculateLightDirection(light.pan, light.tilt);

      const distanceToActor = pointToRayDistance(
        lightPos,
        lightDir,
        { x: actor.position.x, y: actor.position.y + actor.height / 2, z: actor.position.z }
      );

      if (distanceToActor < actor.radius + 0.5) {
        risks.push({
          id: generateUUID(),
          type: 'collision',
          level: 'critical',
          time,
          description: `灯具 [${light.lightId}] 光束可能照射到演员 [${actor.actorId}]`,
          involvedObjects: [light.lightId, actor.actorId],
          location: {
            x: (lightPos.x + actor.position.x) / 2,
            y: (lightPos.y + actorTop.y) / 2,
            z: (lightPos.z + actor.position.z) / 2,
          },
          suggestedFix: '调整灯具Pan/Tilt角度，或检查演员走位路线',
        });
      }

      const distToLight = distance3D(lightPos, actorTop);
      if (distToLight < 1.0) {
        risks.push({
          id: generateUUID(),
          type: 'collision',
          level: 'critical',
          time,
          description: `演员 [${actor.actorId}] 距离灯具 [${light.lightId}] 过近 (${distToLight.toFixed(2)}m)`,
          involvedObjects: [light.lightId, actor.actorId],
          location: actorTop,
          suggestedFix: '调整吊杆高度或演员走位',
        });
      }
    }
  }

  for (let i = 0; i < rigStates.length; i++) {
    for (let j = i + 1; j < rigStates.length; j++) {
      const r1 = rigStates[i];
      const r2 = rigStates[j];

      const heightDiff = Math.abs(r1.height - r2.height);
      const xOverlap = lineSegmentOverlap(
        r1.position.x - r1.length / 2,
        r1.position.x + r1.length / 2,
        r2.position.x - r2.length / 2,
        r2.position.x + r2.length / 2
      );

      if (xOverlap && heightDiff < 0.5) {
        risks.push({
          id: generateUUID(),
          type: 'occlusion',
          level: 'warning',
          time,
          description: `吊杆 [${r1.rigId}] 和 [${r2.rigId}] 可能互相遮挡 (高度差: ${heightDiff.toFixed(2)}m)`,
          involvedObjects: [r1.rigId, r2.rigId],
          location: {
            x: (r1.position.x + r2.position.x) / 2,
            y: (r1.height + r2.height) / 2,
            z: (r1.position.z + r2.position.z) / 2,
          },
          suggestedFix: '调整吊杆高度，增加间距',
        });
      }
    }
  }

  return risks;
}

function checkIllumination(context: EvaluationContext): Risk[] {
  const risks: Risk[] = [];
  const { project, time } = context;
  const minLux = project.targetMinLux || 500;

  const lightStates = project.lights.map((l) => getLightState(context, l));
  const actorStates = project.actors.map((a) => getActorState(context, a));

  for (const actor of actorStates) {
    const actorCenter = {
      x: actor.position.x,
      y: actor.position.y + actor.height / 2,
      z: actor.position.z,
    };

    let totalIlluminance = 0;

    for (const light of lightStates) {
      if (light.intensity <= 0) continue;

      const illuminance = calculateIlluminance(light, actorCenter);
      totalIlluminance += illuminance;
    }

    if (totalIlluminance < minLux) {
      risks.push({
        id: generateUUID(),
        type: 'illumination',
        level: 'warning',
        time,
        description: `演员 [${actor.actorId}] 位置照度不足: ${totalIlluminance.toFixed(0)} lux (目标: ${minLux} lux)`,
        involvedObjects: [actor.actorId],
        location: actorCenter,
        suggestedFix: '增加指向该区域的灯具强度，或调整灯具角度',
      });
    }
  }

  return risks;
}

function checkHeightLimits(context: EvaluationContext): Risk[] {
  const risks: Risk[] = [];
  const { project, time } = context;

  const rigStates = project.rigs.map((r) => getRigState(context, r));
  const actorStates = project.actors.map((a) => getActorState(context, a));

  for (const zone of project.restrictedZones) {
    if (zone.type !== 'heightLimit' || zone.maxHeight === undefined) continue;

    for (const actor of actorStates) {
      const inZone = isPointInBounds(actor.position, zone.bounds);
      if (!inZone) continue;

      const actorTop = actor.position.y + actor.height;
      if (actorTop > zone.maxHeight) {
        risks.push({
          id: generateUUID(),
          type: 'height',
          level: 'critical',
          time,
          description: `演员 [${actor.actorId}] 超高 (${actorTop.toFixed(2)}m > 限制 ${zone.maxHeight}m)`,
          involvedObjects: [actor.actorId, zone.id],
          location: { x: actor.position.x, y: actorTop, z: actor.position.z },
          suggestedFix: '调整演员走位或限制区高度设置',
        });
      }
    }

    for (const rig of rigStates) {
      const rigCenter = {
        x: rig.position.x,
        y: rig.height,
        z: rig.position.z,
      };

      const inZone = isPointInBounds(rigCenter, zone.bounds);
      if (!inZone) continue;

      if (rig.height > zone.maxHeight) {
        risks.push({
          id: generateUUID(),
          type: 'height',
          level: 'warning',
          time,
          description: `吊杆 [${rig.rigId}] 超高 (${rig.height.toFixed(2)}m > 限制 ${zone.maxHeight}m)`,
          involvedObjects: [rig.rigId, zone.id],
          location: rigCenter,
          suggestedFix: '降低吊杆高度',
        });
      }
    }
  }

  return risks;
}

function checkNoEntryZones(context: EvaluationContext): Risk[] {
  const risks: Risk[] = [];
  const { project, time } = context;

  const actorStates = project.actors.map((a) => getActorState(context, a));

  for (const zone of project.restrictedZones) {
    if (zone.type !== 'noEntry') continue;

    for (const actor of actorStates) {
      const inZone = isPointInBounds(actor.position, zone.bounds);
      if (inZone) {
        risks.push({
          id: generateUUID(),
          type: 'collision',
          level: 'critical',
          time,
          description: `演员 [${actor.actorId}] 进入禁入区 [${zone.name}]`,
          involvedObjects: [actor.actorId, zone.id],
          location: actor.position,
          suggestedFix: '调整演员走位路线',
        });
      }
    }
  }

  return risks;
}

function calculateLightDirection(pan: number, tilt: number): Vector3 {
  const panRad = degToRad(pan);
  const tiltRad = degToRad(tilt);

  return {
    x: Math.sin(panRad) * Math.cos(tiltRad),
    y: -Math.sin(tiltRad),
    z: Math.cos(panRad) * Math.cos(tiltRad),
  };
}

function pointToRayDistance(
  rayOrigin: Vector3,
  rayDir: Vector3,
  point: Vector3
): number {
  const oc = {
    x: point.x - rayOrigin.x,
    y: point.y - rayOrigin.y,
    z: point.z - rayOrigin.z,
  };

  const dot = oc.x * rayDir.x + oc.y * rayDir.y + oc.z * rayDir.z;
  const ocMag = Math.sqrt(oc.x * oc.x + oc.y * oc.y + oc.z * oc.z);

  return Math.sqrt(ocMag * ocMag - dot * dot);
}

function calculateIlluminance(light: LightState, point: Vector3): number {
  const dx = point.x - light.position.x;
  const dy = point.y - light.position.y;
  const dz = point.z - light.position.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (distance < 0.1) return 0;

  const lightDir = calculateLightDirection(light.pan, light.tilt);
  const toPoint = {
    x: dx / distance,
    y: dy / distance,
    z: dz / distance,
  };

  const dot = lightDir.x * toPoint.x + lightDir.y * toPoint.y + lightDir.z * toPoint.z;
  if (dot <= 0) return 0;

  const angle = Math.acos(dot);
  const halfBeamRad = degToRad(light.beamAngle / 2);

  if (angle > halfBeamRad) {
    const outerAngle = halfBeamRad * 1.5;
    if (angle > outerAngle) return 0;
    const t = (angle - halfBeamRad) / (outerAngle - halfBeamRad);
    return (
      ((1 - t) * light.intensity * light.intensity * Math.cos(angle)) / (distance * distance)
    );
  }

  return (light.intensity * light.intensity * Math.cos(angle)) / (distance * distance);
}

function lineSegmentOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  const minA = Math.min(a1, a2);
  const maxA = Math.max(a1, a2);
  const minB = Math.min(b1, b2);
  const maxB = Math.max(b1, b2);

  return !(maxA < minB || maxB < minA);
}

function isPointInBounds(point: Vector3, bounds: { min: Vector3; max: Vector3 }): boolean {
  return (
    point.x >= bounds.min.x &&
    point.x <= bounds.max.x &&
    point.y >= bounds.min.y &&
    point.y <= bounds.max.y &&
    point.z >= bounds.min.z &&
    point.z <= bounds.max.z
  );
}

export function evaluateRisksAtTime(context: EvaluationContext): Risk[] {
  const risks: Risk[] = [];

  risks.push(...checkCollisions(context));
  risks.push(...checkIllumination(context));
  risks.push(...checkHeightLimits(context));
  risks.push(...checkNoEntryZones(context));

  return risks;
}

export function evaluateAllRisks(
  project: StageProject,
  timeStep: number = 1.0
): Map<number, Risk[]> {
  const result = new Map<number, Risk[]>();

  const maxTime = getTotalDuration(project);
  if (maxTime <= 0) return result;

  for (let t = 0; t <= maxTime; t += timeStep) {
    const context: EvaluationContext = { project, time: t };
    const risks = evaluateRisksAtTime(context);
    if (risks.length > 0) {
      result.set(t, risks);
    }
  }

  return result;
}

export function getTotalDuration(project: StageProject): number {
  let maxTime = 0;

  for (const timeline of project.actorTimelines) {
    if (timeline.keyframes.length > 0) {
      const last = timeline.keyframes[timeline.keyframes.length - 1];
      maxTime = Math.max(maxTime, last.time);
    }
  }

  for (const timeline of project.rigTimelines) {
    if (timeline.keyframes.length > 0) {
      const last = timeline.keyframes[timeline.keyframes.length - 1];
      maxTime = Math.max(maxTime, last.time);
    }
  }

  for (const timeline of project.lightTimelines) {
    if (timeline.keyframes.length > 0) {
      const last = timeline.keyframes[timeline.keyframes.length - 1];
      maxTime = Math.max(maxTime, last.time);
    }
  }

  for (const scene of project.scenes) {
    maxTime = Math.max(maxTime, scene.endTime);
  }

  return maxTime;
}
