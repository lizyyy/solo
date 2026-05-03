import { v4 as uuidv4 } from 'uuid';
import { 
  Fixture, 
  PatchEntry, 
  Cue, 
  Project, 
  ProjectSettings, 
  FixtureChannel 
} from './types';

export function createDefaultProjectSettings(): ProjectSettings {
  return {
    maxChannelsPerUniverse: 512,
    maxPower: 10000,
    powerUnit: 'W',
    timePrecision: 2,
    blackoutSafetyMargin: 0.5,
    fadeOverlapThreshold: 0.1
  };
}

export function createDefaultProject(name?: string): Project {
  return {
    id: uuidv4(),
    name: name || '未命名项目',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fixtures: [],
    patches: [],
    cues: [],
    settings: createDefaultProjectSettings()
  };
}

export function createFixture(
  name: string,
  channelCount: number,
  power: number,
  options?: Partial<Fixture>
): Fixture {
  const channels: FixtureChannel[] = [];
  for (let i = 1; i <= channelCount; i++) {
    channels.push({
      number: i,
      name: `通道 ${i}`,
      type: 'other'
    });
  }

  return {
    id: uuidv4(),
    name,
    model: options?.model || '通用灯具',
    manufacturer: options?.manufacturer || '未知厂商',
    channelCount,
    channels,
    power,
    powerUnit: options?.powerUnit || 'W',
    type: options?.type || 'other',
    dmxMode: options?.dmxMode || '标准模式',
    notes: options?.notes,
    ...options
  };
}

export function createPatchEntry(
  fixtureId: string,
  universe: number,
  startChannel: number,
  channelCount: number,
  options?: Partial<PatchEntry>
): PatchEntry {
  return {
    id: uuidv4(),
    fixtureId,
    universe,
    startChannel,
    endChannel: startChannel + channelCount - 1,
    patchName: options?.patchName || `Patch ${universe}.${startChannel}`,
    notes: options?.notes,
    ...options
  };
}

export function createCue(
  number: string,
  time: number,
  options?: Partial<Cue>
): Cue {
  const now = Date.now();
  return {
    id: uuidv4(),
    number,
    name: options?.name || `Cue ${number}`,
    time,
    fadeIn: options?.fadeIn || 0,
    fadeOut: options?.fadeOut || 0,
    delay: options?.delay || 0,
    isLocked: options?.isLocked || false,
    isBlackout: options?.isBlackout || false,
    activeFixtures: options?.activeFixtures || [],
    notes: options?.notes,
    createdAt: now,
    updatedAt: now
  };
}

export function updateCue(cue: Cue, updates: Partial<Cue>): Cue {
  return {
    ...cue,
    ...updates,
    updatedAt: Date.now()
  };
}

export function getCueStartTime(cue: Cue): number {
  return cue.time + cue.delay;
}

export function getCueEndTime(cue: Cue): number {
  const startTime = getCueStartTime(cue);
  return startTime + Math.max(cue.fadeIn, cue.fadeOut);
}

export function getCueFadeInPeriod(cue: Cue): { start: number; end: number } {
  const start = getCueStartTime(cue);
  return {
    start,
    end: start + cue.fadeIn
  };
}

export function getCueFadeOutPeriod(cue: Cue): { start: number; end: number } {
  const endTime = getCueEndTime(cue);
  return {
    start: endTime - cue.fadeOut,
    end: endTime
  };
}

export function calculateTotalPower(fixtures: Fixture[]): number {
  return fixtures.reduce((total, fixture) => {
    const powerInWatts = fixture.powerUnit === 'kW' 
      ? fixture.power * 1000 
      : fixture.power;
    return total + powerInWatts;
  }, 0);
}
