export interface FixtureChannel {
  number: number;
  name: string;
  type: 'intensity' | 'color' | 'position' | 'gobo' | 'effect' | 'other';
  defaultValue?: number;
}

export interface Fixture {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  channelCount: number;
  channels: FixtureChannel[];
  power: number;
  powerUnit: 'W' | 'kW';
  type: 'spot' | 'wash' | 'par' | 'moving' | 'led' | 'other';
  dmxMode: string;
  notes?: string;
}

export interface PatchEntry {
  id: string;
  fixtureId: string;
  universe: number;
  startChannel: number;
  endChannel: number;
  patchName: string;
  notes?: string;
}

export interface Cue {
  id: string;
  number: string;
  name: string;
  time: number;
  fadeIn: number;
  fadeOut: number;
  delay: number;
  isLocked: boolean;
  isBlackout: boolean;
  activeFixtures: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CueTimePoint {
  cueId: string;
  type: 'start' | 'end' | 'fadeIn_start' | 'fadeIn_end' | 'fadeOut_start' | 'fadeOut_end';
  time: number;
}

export interface ChannelOccupation {
  channel: number;
  universe: number;
  fixtureId: string;
  startTime: number;
  endTime: number;
}

export interface PowerConsumptionPoint {
  time: number;
  power: number;
  fixtureIds: string[];
}

export interface ValidationError {
  id: string;
  type: 'channel_conflict' | 'power_overload' | 'blackout_issue' | 'fade_conflict' | 'data_error';
  severity: 'error' | 'warning' | 'info';
  message: string;
  details: string;
  affectedItems: string[];
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  fixtures: Fixture[];
  patches: PatchEntry[];
  cues: Cue[];
  settings: ProjectSettings;
}

export interface ProjectSettings {
  maxChannelsPerUniverse: number;
  maxPower: number;
  powerUnit: 'W' | 'kW';
  timePrecision: number;
  blackoutSafetyMargin: number;
  fadeOverlapThreshold: number;
}
