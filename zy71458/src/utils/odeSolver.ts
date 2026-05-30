import {
  SimulationConfig,
  SimulationResultPoint,
  SimulationConclusion,
  EvidenceItem,
} from '../types/simulation';
import {
  calculateEliminationRate,
  calculateSteadyStateConcentration,
  calculateTimeToSteadyState,
  calculatePeakConcentration,
  calculateTroughConcentration,
  checkDoseHalfLifeConsistency,
} from './pharmacokinetics';

const odeFunction = (concentration: number, eliminationRate: number): number => {
  return -eliminationRate * concentration;
};

const rungeKutta4 = (
  y0: number,
  t0: number,
  dt: number,
  k: number
): number => {
  const k1 = odeFunction(y0, k);
  const k2 = odeFunction(y0 + (dt / 2) * k1, k);
  const k3 = odeFunction(y0 + (dt / 2) * k2, k);
  const k4 = odeFunction(y0 + dt * k3, k);
  
  return y0 + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
};

export const runSimulation = (config: SimulationConfig): {
  results: SimulationResultPoint[];
  conclusion: SimulationConclusion;
} => {
  const { drug, dosing, simulationDuration, timeStep } = config;
  
  const eliminationRate = calculateEliminationRate(drug.halfLife);
  const dosePerAdministration = dosing.dose / drug.volumeOfDistribution;
  
  const results: SimulationResultPoint[] = [];
  const evidence: EvidenceItem[] = [];
  const thresholdEvents: { time: number; concentration: number; type: 'above' | 'below' }[] = [];
  
  let currentConcentration = 0;
  let currentTime = 0;
  let lastDoseTime = -Infinity;
  let orderCounter = 0;
  
  const consistencyCheck = checkDoseHalfLifeConsistency(drug, dosing);
  if (!consistencyCheck.consistent) {
    evidence.push({
      type: 'interval',
      timestamp: 0,
      value: dosing.interval,
      description: consistencyCheck.evidence,
      order: orderCounter++,
    });
  }
  
  const dosingTimes: number[] = [];
  for (let i = 0; i < dosing.dosesCount; i++) {
    dosingTimes.push(dosing.startTime + i * dosing.interval);
  }
  
  let prevConcentration = 0;
  let prevIsAboveMax = false;
  let prevIsBelowMin = true;
  
  while (currentTime <= simulationDuration) {
    let concentrationAtTime = currentConcentration;
    let isDosingPoint = false;
    
    for (const doseTime of dosingTimes) {
      if (Math.abs(currentTime - doseTime) < timeStep / 2) {
        concentrationAtTime += dosePerAdministration;
        isDosingPoint = true;
        lastDoseTime = currentTime;
        break;
      }
    }
    
    const isAboveMax = concentrationAtTime > drug.therapeuticMax;
    const isBelowMin = concentrationAtTime < drug.therapeuticMin;
    
    if (!prevIsAboveMax && isAboveMax) {
      thresholdEvents.push({
        time: currentTime,
        concentration: concentrationAtTime,
        type: 'above',
      });
    }
    if (!prevIsBelowMin && isBelowMin) {
      thresholdEvents.push({
        time: currentTime,
        concentration: concentrationAtTime,
        type: 'below',
      });
    }
    
    let eventType: SimulationResultPoint['eventType'];
    if (isDosingPoint) {
      eventType = 'dosing';
    }
    
    results.push({
      time: currentTime,
      concentration: concentrationAtTime,
      isDosingPoint,
      isAboveMax,
      isBelowMin,
      eventType,
    });
    
    prevConcentration = concentrationAtTime;
    prevIsAboveMax = isAboveMax;
    prevIsBelowMin = isBelowMin;
    
    const nextTime = currentTime + timeStep;
    currentConcentration = rungeKutta4(concentrationAtTime, currentTime, timeStep, eliminationRate);
    currentTime = nextTime;
  }
  
  thresholdEvents
    .sort((a, b) => a.time - b.time)
    .forEach((event) => {
      evidence.push({
        type: 'threshold_cross',
        timestamp: event.time,
        value: event.concentration,
        description: `${event.time.toFixed(1)}h 时浓度${event.type === 'above' ? '超过' : '低于'}治疗窗: ${event.concentration.toFixed(3)} ${drug.unit}`,
        order: orderCounter++,
      });
    });
  
  const steadyStateConc = calculateSteadyStateConcentration(
    dosing.dose,
    drug.volumeOfDistribution,
    dosing.interval,
    eliminationRate
  );
  
  const peakConc = calculatePeakConcentration(
    dosing.dose,
    drug.volumeOfDistribution,
    dosing.interval,
    eliminationRate,
    dosing.dosesCount
  );
  
  const troughConc = calculateTroughConcentration(peakConc, eliminationRate, dosing.interval);
  const timeToSteady = calculateTimeToSteadyState(drug.halfLife);
  
  const hasIssue = thresholdEvents.length > 0 || !consistencyCheck.consistent;
  
  let issueDescription = '';
  if (thresholdEvents.length > 0) {
    const aboveCount = thresholdEvents.filter(e => e.type === 'above').length;
    const belowCount = thresholdEvents.filter(e => e.type === 'below').length;
    if (aboveCount > 0) issueDescription += `浓度${aboveCount}次超过上限; `;
    if (belowCount > 0) issueDescription += `浓度${belowCount}次低于下限; `;
  }
  if (!consistencyCheck.consistent) {
    issueDescription += consistencyCheck.evidence;
  }
  
  return {
    results,
    conclusion: {
      steadyStateConcentration: steadyStateConc,
      timeToReachSteadyState: timeToSteady,
      peakConcentration: peakConc,
      troughConcentration: troughConc,
      hasConcentrationIssue: hasIssue,
      issueDescription: issueDescription || '模拟参数合理，浓度维持在治疗窗内',
      doseHalfLifeConsistent: consistencyCheck.consistent,
      evidence: evidence.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    },
  };
};
