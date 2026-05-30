import { Speaker, MeasurePoint, CalculationResult, IntermediateValue, PhaseIntermediate } from '../types';

const SOUND_SPEED = 343;
const I_REF = 1e-12;
const LW_BASE = 112;
const Q_FACTOR = 1;

export function calculateDistance(speaker: Speaker, point: MeasurePoint): number {
  const dx = speaker.x - point.x;
  const dy = speaker.y - point.y;
  const dz = speaker.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function calculateTravelTime(distance: number): number {
  return distance / SOUND_SPEED;
}

export function calculateSpl(speaker: Speaker, distance: number): number {
  const geometricSpreading = 10 * Math.log10(Q_FACTOR / (4 * Math.PI * distance * distance));
  const powerFactor = 10 * Math.log10(speaker.power / 1000);
  return LW_BASE + geometricSpreading + powerFactor;
}

export function calculateIntensity(spl: number): number {
  return Math.pow(10, spl / 10) * I_REF;
}

export function calculatePhaseDiff(timeDiff: number, frequency: number): number {
  const period = 1 / frequency;
  const normalizedDiff = Math.abs(timeDiff) % period;
  return (normalizedDiff / period) * 360;
}

export function calculateCancelFactor(phaseDiff: number): number {
  const phaseRad = (phaseDiff * Math.PI) / 180;
  return Math.abs(Math.cos(phaseRad / 2));
}

export function normalizePhaseDiff(phaseDiff: number): number {
  let normalized = phaseDiff % 360;
  if (normalized > 180) normalized = 360 - normalized;
  if (normalized < -180) normalized = 360 + normalized;
  return Math.abs(normalized);
}

export function calculateIntermediates(
  speakers: Speaker[],
  point: MeasurePoint
): IntermediateValue[] {
  return speakers.map((speaker) => {
    const distance = calculateDistance(speaker, point);
    const spl = calculateSpl(speaker, distance);
    const intensity = calculateIntensity(spl);
    const travelTime = calculateTravelTime(distance);
    const totalTime = travelTime + speaker.delay / 1000;

    return {
      speakerId: speaker.id,
      speakerName: speaker.name,
      distance,
      spl,
      intensity,
      travelTime,
      totalTime,
    };
  });
}

export function calculatePhaseIntermediates(
  speakers: Speaker[],
  intermediates: IntermediateValue[],
  frequency: number
): PhaseIntermediate[] {
  const phaseResults: PhaseIntermediate[] = [];

  for (let i = 0; i < speakers.length; i++) {
    for (let j = i + 1; j < speakers.length; j++) {
      const s1 = speakers[i];
      const s2 = speakers[j];
      const t1 = intermediates[i].totalTime;
      const t2 = intermediates[j].totalTime;
      const timeDiff = Math.abs(t1 - t2);
      const phaseDiff = calculatePhaseDiff(timeDiff, frequency);
      const normalizedPhaseDiff = normalizePhaseDiff(phaseDiff);
      const cancelFactor = calculateCancelFactor(normalizedPhaseDiff);

      phaseResults.push({
        speakerId1: s1.id,
        speakerName1: s1.name,
        speakerId2: s2.id,
        speakerName2: s2.name,
        timeDiff,
        phaseDiff: normalizedPhaseDiff,
        cancelFactor,
      });
    }
  }

  return phaseResults;
}

export function calculateTotalIntensity(
  intermediates: IntermediateValue[],
  phaseIntermediates: PhaseIntermediate[]
): { totalIntensity: number; combinedIntensity: number; phaseCancelFactor: number; maxPhaseDiff: number } {
  const directIntensity = intermediates.reduce((sum, im) => sum + im.intensity, 0);

  let interferenceAdjustment = 0;
  let maxPhaseDiff = 0;
  let minCancelFactor = 1;

  phaseIntermediates.forEach((pi) => {
    if (pi.phaseDiff > maxPhaseDiff) {
      maxPhaseDiff = pi.phaseDiff;
    }
    if (pi.cancelFactor < minCancelFactor) {
      minCancelFactor = pi.cancelFactor;
    }

    const i1 = intermediates.find((im) => im.speakerId === pi.speakerId1)?.intensity || 0;
    const i2 = intermediates.find((im) => im.speakerId === pi.speakerId2)?.intensity || 0;

    const interaction = 2 * Math.sqrt(i1 * i2) * (pi.cancelFactor - 0.5) * 2;
    interferenceAdjustment += interaction;
  });

  const combinedIntensity = Math.max(0, directIntensity + interferenceAdjustment);
  const phaseCancelFactor = minCancelFactor;

  return {
    totalIntensity: directIntensity,
    combinedIntensity,
    phaseCancelFactor,
    maxPhaseDiff,
  };
}

export function calculateSplFromIntensity(intensity: number): number {
  if (intensity <= 0) return 0;
  return 10 * Math.log10(intensity / I_REF);
}

export function calculateSoundPressure(
  speakers: Speaker[],
  point: MeasurePoint,
  frequency: number,
  pointId?: string
): CalculationResult {
  const intermediates = calculateIntermediates(speakers, point);
  const phaseIntermediates = calculatePhaseIntermediates(speakers, intermediates, frequency);
  const { combinedIntensity, phaseCancelFactor, maxPhaseDiff } = calculateTotalIntensity(
    intermediates,
    phaseIntermediates
  );
  const totalSpl = calculateSplFromIntensity(combinedIntensity);

  return {
    id: `result_${point.x}_${point.y}_${Date.now()}`,
    pointId: pointId || point.id,
    x: point.x,
    y: point.y,
    totalSpl,
    totalIntensity: combinedIntensity,
    phaseCancelFactor,
    maxPhaseDiff,
    intermediates,
    phaseIntermediates,
    errors: [],
  };
}

export function generateMeasurePoints(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  step: number
): MeasurePoint[] {
  const points: MeasurePoint[] = [];
  let id = 0;
  for (let x = minX; x <= maxX; x += step) {
    for (let y = minY; y <= maxY; y += step) {
      points.push({
        id: `point_${id++}`,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      });
    }
  }
  return points;
}

export function calculateAllPoints(
  speakers: Speaker[],
  points: MeasurePoint[],
  frequency: number
): CalculationResult[] {
  return points.map((point) =>
    calculateSoundPressure(speakers, point, frequency, point.id)
  );
}
