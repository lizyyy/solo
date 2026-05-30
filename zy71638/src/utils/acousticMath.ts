import { Position3D, Microphone, DrumPiece, PhaseRelation, CrosstalkData, ValidationError } from '@/types';
import { DISTANCE_UNIT_FACTORS } from './constants';
import * as THREE from 'three';

export function getDistance(p1: Position3D, p2: Position3D): number {
  return Math.sqrt(
    Math.pow(p2.x - p1.x, 2) +
    Math.pow(p2.y - p1.y, 2) +
    Math.pow(p2.z - p1.z, 2)
  );
}

export function convertToMeters(value: number, unit: string): number {
  const factor = DISTANCE_UNIT_FACTORS[unit as keyof typeof DISTANCE_UNIT_FACTORS] || 1;
  return value * factor;
}

export function convertFromMeters(meters: number, unit: string): number {
  const factor = DISTANCE_UNIT_FACTORS[unit as keyof typeof DISTANCE_UNIT_FACTORS] || 1;
  return meters / factor;
}

export function formatDistance(meters: number, unit: string): string {
  const value = convertFromMeters(meters, unit);
  if (unit === 'm') {
    return `${value.toFixed(2)} m`;
  } else if (unit === 'cm') {
    return `${value.toFixed(1)} cm`;
  } else {
    return `${value.toFixed(1)} inch`;
  }
}

export function calculateAngle(mic: Microphone, target: Position3D): number {
  const micPos = new THREE.Vector3(mic.position.x, mic.position.y, mic.position.z);
  const targetPos = new THREE.Vector3(target.x, target.y, target.z);
  
  const micDir = new THREE.Vector3(0, 0, -1);
  micDir.applyEuler(new THREE.Euler(mic.rotation.x, mic.rotation.y, mic.rotation.z));
  
  const toTarget = targetPos.clone().sub(micPos).normalize();
  
  return micDir.angleTo(toTarget);
}

export function getPolarPatternGain(pattern: string, angle: number): number {
  switch (pattern) {
    case 'cardioid':
      return 20 * Math.log10(0.5 + 0.5 * Math.cos(angle));
    case 'omnidirectional':
      return 0;
    case 'bidirectional':
    case 'figure8':
      return 20 * Math.log10(Math.abs(Math.cos(angle)));
    default:
      return 0;
  }
}

export function calculateDirectionFactor(mic1: Microphone, mic2: Microphone): number {
  const pos1 = new THREE.Vector3(mic1.position.x, mic1.position.y, mic1.position.z);
  const pos2 = new THREE.Vector3(mic2.position.x, mic2.position.y, mic2.position.z);
  
  const dir1 = new THREE.Vector3(0, 0, -1);
  dir1.applyEuler(new THREE.Euler(mic1.rotation.x, mic1.rotation.y, mic1.rotation.z));
  
  const dir2 = new THREE.Vector3(0, 0, -1);
  dir2.applyEuler(new THREE.Euler(mic2.rotation.x, mic2.rotation.y, mic2.rotation.z));
  
  const toMic2 = pos2.clone().sub(pos1).normalize();
  const toMic1 = pos1.clone().sub(pos2).normalize();
  
  const alignment1 = dir1.dot(toMic2);
  const alignment2 = dir2.dot(toMic1);
  
  return (alignment1 + alignment2) / 2 + 1;
}

export function calculatePhaseRelation(
  mic1: Microphone,
  mic2: Microphone,
  speedOfSound: number = 343
): PhaseRelation {
  const distance = getDistance(mic1.position, mic2.position);
  const referenceFreq = 1000;
  const wavelength = speedOfSound / referenceFreq;
  const phaseDiff = ((distance % wavelength) / wavelength) * 360;
  
  const directionFactor = calculateDirectionFactor(mic1, mic2);
  let adjustedPhaseDiff = phaseDiff * directionFactor;
  
  adjustedPhaseDiff += (mic1.phaseInverted ? 180 : 0) - (mic2.phaseInverted ? 180 : 0);
  adjustedPhaseDiff = ((adjustedPhaseDiff % 360) + 360) % 360;
  
  const isCoherent = adjustedPhaseDiff < 30 || adjustedPhaseDiff > 330;
  const correlation = isCoherent ? 0.9 : Math.max(0.1, 1 - Math.abs(adjustedPhaseDiff - 180) / 180);
  
  return {
    mic1Id: mic1.id,
    mic2Id: mic2.id,
    phaseDiff: adjustedPhaseDiff,
    isCoherent,
    correlation,
  };
}

export function calculateCrosstalk(
  sourceMic: Microphone,
  targetMic: Microphone,
  drumPiece: DrumPiece
): CrosstalkData {
  const distanceToSource = getDistance(drumPiece.position, sourceMic.position);
  const distanceToTarget = getDistance(drumPiece.position, targetMic.position);
  
  const levelDiff = 20 * Math.log10(Math.max(0.01, distanceToSource / distanceToTarget));
  
  const sourceAngle = calculateAngle(sourceMic, drumPiece.position);
  const targetAngle = calculateAngle(targetMic, drumPiece.position);
  
  const sourcePolarFactor = getPolarPatternGain(sourceMic.polarPattern, sourceAngle);
  const targetPolarFactor = getPolarPatternGain(targetMic.polarPattern, targetAngle);
  
  const crosstalkLevel = Math.max(-60, levelDiff + sourcePolarFactor - targetPolarFactor);
  
  return {
    sourceMicId: sourceMic.id,
    targetMicId: targetMic.id,
    level: crosstalkLevel,
    frequency: 'mid',
  };
}

export function distanceToLineSegment(
  point: THREE.Vector3,
  lineStart: THREE.Vector3,
  lineEnd: THREE.Vector3
): number {
  const line = lineEnd.clone().sub(lineStart);
  const lineLength = line.length();
  const lineDir = line.normalize();
  
  const toPoint = point.clone().sub(lineStart);
  const projection = toPoint.dot(lineDir);
  
  if (projection <= 0) {
    return point.distanceTo(lineStart);
  }
  if (projection >= lineLength) {
    return point.distanceTo(lineEnd);
  }
  
  const projectionPoint = lineStart.clone().add(lineDir.multiplyScalar(projection));
  return point.distanceTo(projectionPoint);
}

export function detectOcclusion(
  mic: Microphone,
  drumPiece: DrumPiece,
  allPieces: DrumPiece[],
  generateId: () => string
): ValidationError | null {
  const lineStart = new THREE.Vector3(mic.position.x, mic.position.y, mic.position.z);
  const lineEnd = new THREE.Vector3(drumPiece.position.x, drumPiece.position.y, drumPiece.position.z);
  
  for (const piece of allPieces) {
    if (piece.id === drumPiece.id) continue;
    
    const piecePos = new THREE.Vector3(piece.position.x, piece.position.y, piece.position.z);
    const distance = distanceToLineSegment(piecePos, lineStart, lineEnd);
    
    if (distance < 0.3) {
      return {
        id: generateId(),
        severity: 'warning',
        category: 'occlusion',
        field: 'position',
        message: `麦克风「${mic.name}」与鼓件「${drumPiece.name}」之间被「${piece.name}」遮挡`,
        suggestion: `建议将麦克风向侧面移动至少30cm，或调整高度避开遮挡物`,
        sourceId: mic.id,
      };
    }
  }
  return null;
}

export function getDrumPieceRadius(type: string): number {
  switch (type) {
    case 'kick': return 0.35;
    case 'snare': return 0.2;
    case 'tom1':
    case 'tom2': return 0.18;
    case 'floorTom': return 0.22;
    case 'hihat':
    case 'crash':
    case 'ride': return 0.25;
    default: return 0.2;
  }
}

export function getCrosstalkColor(level: number): string {
  if (level <= -40) return '#10b981';
  if (level <= -30) return '#84cc16';
  if (level <= -20) return '#f59e0b';
  if (level <= -10) return '#f97316';
  return '#ef4444';
}

export function getPhaseColor(phaseDiff: number): string {
  const normalized = ((phaseDiff % 360) + 360) % 360;
  if (normalized < 30 || normalized > 330) return '#10b981';
  if (normalized < 90 || normalized > 270) return '#f59e0b';
  if (normalized < 150 || normalized > 210) return '#f97316';
  return '#ef4444';
}

export function getPhaseLabel(phaseDiff: number): string {
  const normalized = ((phaseDiff % 360) + 360) % 360;
  if (normalized < 30 || normalized > 330) return '同相';
  if (normalized < 90 || normalized > 270) return '轻微偏移';
  if (normalized < 150 || normalized > 210) return '中度偏移';
  return '反向风险';
}
