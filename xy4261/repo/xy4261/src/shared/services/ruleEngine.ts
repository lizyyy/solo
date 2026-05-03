import { 
  Fixture, 
  PatchEntry, 
  Cue, 
  ValidationError,
  ChannelOccupation,
  PowerConsumptionPoint,
  ProjectSettings
} from '../models/types';
import { 
  getCueStartTime, 
  getCueEndTime, 
  getCueFadeInPeriod, 
  getCueFadeOutPeriod,
  calculateTotalPower
} from '../models';
import { v4 as uuidv4 } from 'uuid';

export interface RuleEngineResult {
  errors: ValidationError[];
  warnings: ValidationError[];
  channelOccupations: ChannelOccupation[];
  powerConsumption: PowerConsumptionPoint[];
  maxPower: number;
  totalRuntime: number;
}

export interface ChannelConflict {
  channel: number;
  universe: number;
  fixture1Id: string;
  fixture2Id: string;
  timeRange: { start: number; end: number };
}

export interface FadeConflict {
  cue1Id: string;
  cue2Id: string;
  type: 'fade_in_overlap' | 'fade_out_overlap' | 'cross_fade_conflict';
  timeRange: { start: number; end: number };
}

export interface BlackoutIssue {
  cueId: string;
  type: 'unexpected_blackout' | 'missing_blackout' | 'blackout_overlap';
  time: number;
  description: string;
}

export function runAllChecks(
  fixtures: Fixture[],
  patches: PatchEntry[],
  cues: Cue[],
  settings: ProjectSettings
): RuleEngineResult {
  const sortedCues = [...cues].sort((a, b) => a.time - b.time);
  
  const channelOccupations = calculateChannelOccupations(fixtures, patches, sortedCues);
  const powerConsumption = calculatePowerConsumption(fixtures, sortedCues, settings);
  
  const channelConflicts = checkChannelConflicts(channelOccupations, settings);
  const powerOverloads = checkPowerOverload(powerConsumption, settings);
  const fadeConflicts = checkFadeConflicts(sortedCues, settings);
  const blackoutIssues = checkBlackoutIssues(sortedCues, settings);
  
  const maxPower = powerConsumption.length > 0 
    ? Math.max(...powerConsumption.map(p => p.power))
    : 0;
  
  const totalRuntime = sortedCues.length > 0 
    ? getCueEndTime(sortedCues[sortedCues.length - 1])
    : 0;

  const allErrors: ValidationError[] = [
    ...channelConflicts.filter(c => c.severity === 'error'),
    ...powerOverloads.filter(c => c.severity === 'error'),
    ...fadeConflicts.filter(c => c.severity === 'error'),
    ...blackoutIssues.filter(c => c.severity === 'error')
  ];

  const allWarnings: ValidationError[] = [
    ...channelConflicts.filter(c => c.severity === 'warning'),
    ...powerOverloads.filter(c => c.severity === 'warning'),
    ...fadeConflicts.filter(c => c.severity === 'warning'),
    ...blackoutIssues.filter(c => c.severity === 'warning')
  ];

  return {
    errors: allErrors,
    warnings: allWarnings,
    channelOccupations,
    powerConsumption,
    maxPower,
    totalRuntime
  };
}

export function calculateChannelOccupations(
  fixtures: Fixture[],
  patches: PatchEntry[],
  cues: Cue[]
): ChannelOccupation[] {
  const occupations: ChannelOccupation[] = [];
  
  const patchMap = new Map<string, PatchEntry>();
  for (const patch of patches) {
    patchMap.set(patch.fixtureId, patch);
  }

  for (const cue of cues) {
    const startTime = getCueStartTime(cue);
    const endTime = getCueEndTime(cue);

    for (const fixtureId of cue.activeFixtures) {
      const patch = patchMap.get(fixtureId);
      if (!patch) continue;

      for (let channel = patch.startChannel; channel <= patch.endChannel; channel++) {
        occupations.push({
          channel,
          universe: patch.universe,
          fixtureId,
          startTime,
          endTime
        });
      }
    }
  }

  return occupations;
}

export function calculatePowerConsumption(
  fixtures: Fixture[],
  cues: Cue[],
  settings: ProjectSettings
): PowerConsumptionPoint[] {
  const timePoints: Set<number> = new Set();
  const fixturePowerMap = new Map<string, number>();

  for (const fixture of fixtures) {
    const powerInWatts = fixture.powerUnit === 'kW' 
      ? fixture.power * 1000 
      : fixture.power;
    fixturePowerMap.set(fixture.id, powerInWatts);
  }

  for (const cue of cues) {
    const startTime = getCueStartTime(cue);
    const endTime = getCueEndTime(cue);
    const fadeInEnd = startTime + cue.fadeIn;
    const fadeOutStart = endTime - cue.fadeOut;

    timePoints.add(startTime);
    timePoints.add(fadeInEnd);
    timePoints.add(fadeOutStart);
    timePoints.add(endTime);
  }

  const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);
  const consumption: PowerConsumptionPoint[] = [];

  for (const time of sortedTimePoints) {
    const activeFixtures: string[] = [];
    let totalPower = 0;

    for (const cue of cues) {
      const startTime = getCueStartTime(cue);
      const endTime = getCueEndTime(cue);

      if (time >= startTime && time <= endTime) {
        const fadeInEnd = startTime + cue.fadeIn;
        const fadeOutStart = endTime - cue.fadeOut;

        let powerFactor = 1;
        if (time < fadeInEnd && cue.fadeIn > 0) {
          powerFactor = (time - startTime) / cue.fadeIn;
        } else if (time > fadeOutStart && cue.fadeOut > 0) {
          powerFactor = 1 - ((time - fadeOutStart) / cue.fadeOut);
        }

        for (const fixtureId of cue.activeFixtures) {
          const fixturePower = fixturePowerMap.get(fixtureId) || 0;
          totalPower += fixturePower * powerFactor;
          
          if (!activeFixtures.includes(fixtureId)) {
            activeFixtures.push(fixtureId);
          }
        }
      }
    }

    consumption.push({
      time,
      power: Math.round(totalPower * 100) / 100,
      fixtureIds: activeFixtures
    });
  }

  return consumption;
}

export function checkChannelConflicts(
  occupations: ChannelOccupation[],
  settings: ProjectSettings
): ValidationError[] {
  const errors: ValidationError[] = [];
  const universeMap = new Map<number, Map<number, ChannelOccupation[]>>();

  for (const occ of occupations) {
    if (!universeMap.has(occ.universe)) {
      universeMap.set(occ.universe, new Map());
    }
    const channelMap = universeMap.get(occ.universe)!;
    
    if (!channelMap.has(occ.channel)) {
      channelMap.set(occ.channel, []);
    }
    channelMap.get(occ.channel)!.push(occ);
  }

  for (const [universe, channelMap] of universeMap) {
    for (const [channel, channelOccupations] of channelMap) {
      if (channelOccupations.length < 2) continue;

      for (let i = 0; i < channelOccupations.length; i++) {
        for (let j = i + 1; j < channelOccupations.length; j++) {
          const occ1 = channelOccupations[i];
          const occ2 = channelOccupations[j];

          if (occ1.fixtureId === occ2.fixtureId) continue;

          const overlapStart = Math.max(occ1.startTime, occ2.startTime);
          const overlapEnd = Math.min(occ1.endTime, occ2.endTime);

          if (overlapStart < overlapEnd) {
            errors.push(createValidationError(
              'channel_conflict',
              'error',
              `通道冲突: Universe ${universe} 通道 ${channel}`,
              `灯具 ${occ1.fixtureId} 和 ${occ2.fixtureId} 在时间 [${overlapStart.toFixed(settings.timePrecision)}s - ${overlapEnd.toFixed(settings.timePrecision)}s] 内同时占用通道 ${channel}`,
              [occ1.fixtureId, occ2.fixtureId]
            ));
          }
        }
      }
    }
  }

  return errors;
}

export function checkPowerOverload(
  consumption: PowerConsumptionPoint[],
  settings: ProjectSettings
): ValidationError[] {
  const errors: ValidationError[] = [];
  const maxPower = settings.maxPower;
  
  const maxPowerInWatts = settings.powerUnit === 'kW' 
    ? maxPower * 1000 
    : maxPower;

  for (let i = 0; i < consumption.length; i++) {
    const point = consumption[i];
    
    if (point.power > maxPowerInWatts) {
      const nextPoint = i < consumption.length - 1 ? consumption[i + 1] : null;
      const endTime = nextPoint ? nextPoint.time : point.time + 1;

      const percentage = (point.power / maxPowerInWatts * 100).toFixed(1);
      
      errors.push(createValidationError(
        'power_overload',
        'error',
        `功率超载: ${percentage}%`,
        `在时间 ${point.time.toFixed(settings.timePrecision)}s 处，功率达到 ${point.power}W，超过最大限制 ${maxPowerInWatts}W`,
        point.fixtureIds
      ));
    }
  }

  return errors;
}

export function checkFadeConflicts(
  cues: Cue[],
  settings: ProjectSettings
): ValidationError[] {
  const errors: ValidationError[] = [];
  const sortedCues = [...cues].sort((a, b) => a.time - b.time);

  for (let i = 0; i < sortedCues.length; i++) {
    for (let j = i + 1; j < sortedCues.length; j++) {
      const cue1 = sortedCues[i];
      const cue2 = sortedCues[j];

      const cue1End = getCueEndTime(cue1);
      const cue2Start = getCueStartTime(cue2);

      if (cue2Start > cue1End + settings.fadeOverlapThreshold) continue;

      const fade1Out = getCueFadeOutPeriod(cue1);
      const fade2In = getCueFadeInPeriod(cue2);

      const overlapStart = Math.max(fade1Out.start, fade2In.start);
      const overlapEnd = Math.min(fade1Out.end, fade2In.end);

      if (overlapStart < overlapEnd) {
        const overlappingFixtures = cue1.activeFixtures.filter(f => 
          cue2.activeFixtures.includes(f)
        );

        if (overlappingFixtures.length > 0) {
          errors.push(createValidationError(
            'fade_conflict',
            'warning',
            `淡变冲突: Cue ${cue1.number} 和 Cue ${cue2.number}`,
            `淡变在时间 [${overlapStart.toFixed(settings.timePrecision)}s - ${overlapEnd.toFixed(settings.timePrecision)}s] 内重叠，涉及灯具: ${overlappingFixtures.join(', ')}`,
            [cue1.id, cue2.id, ...overlappingFixtures]
          ));
        }
      }
    }
  }

  return errors;
}

export function checkBlackoutIssues(
  cues: Cue[],
  settings: ProjectSettings
): ValidationError[] {
  const errors: ValidationError[] = [];
  const sortedCues = [...cues].sort((a, b) => a.time - b.time);

  const blackoutCues = sortedCues.filter(c => c.isBlackout);

  for (const blackout of blackoutCues) {
    const blackoutStart = getCueStartTime(blackout);
    const blackoutEnd = getCueEndTime(blackout);

    for (const cue of sortedCues) {
      if (cue.id === blackout.id) continue;

      const cueStart = getCueStartTime(cue);
      const cueEnd = getCueEndTime(cue);

      if (cueStart < blackoutEnd && cueEnd > blackoutStart) {
        const overlappingFixtures = cue.activeFixtures.filter(f => 
          blackout.activeFixtures.includes(f)
        );

        if (overlappingFixtures.length > 0) {
          errors.push(createValidationError(
            'blackout_issue',
            'error',
            `黑场冲突: Cue ${blackout.number} (黑场) 和 Cue ${cue.number}`,
            `黑场 Cue 与其他 Cue 在时间 [${Math.max(blackoutStart, cueStart).toFixed(settings.timePrecision)}s - ${Math.min(blackoutEnd, cueEnd).toFixed(settings.timePrecision)}s] 内重叠`,
            [blackout.id, cue.id]
          ));
        }
      }
    }
  }

  for (let i = 0; i < sortedCues.length - 1; i++) {
    const currentCue = sortedCues[i];
    const nextCue = sortedCues[i + 1];

    const currentEnd = getCueEndTime(currentCue);
    const nextStart = getCueStartTime(nextCue);

    const gap = nextStart - currentEnd;
    
    if (gap > settings.blackoutSafetyMargin) {
      const hasBlackoutGap = blackoutCues.some(b => {
        const bStart = getCueStartTime(b);
        const bEnd = getCueEndTime(b);
        return bStart >= currentEnd && bEnd <= nextStart;
      });

      if (!hasBlackoutGap && !currentCue.isBlackout && !nextCue.isBlackout) {
        errors.push(createValidationError(
          'blackout_issue',
          'info',
          `潜在黑场窗口: Cue ${currentCue.number} 和 Cue ${nextCue.number} 之间`,
          `两个 Cue 之间有 ${gap.toFixed(settings.timePrecision)}s 的间隙，请确认是否需要黑场 Cue`,
          [currentCue.id, nextCue.id]
        ));
      }
    }
  }

  return errors;
}

function createValidationError(
  type: ValidationError['type'],
  severity: ValidationError['severity'],
  message: string,
  details: string,
  affectedItems: string[]
): ValidationError {
  return {
    id: uuidv4(),
    type,
    severity,
    message,
    details,
    affectedItems,
    timestamp: Date.now()
  };
}
