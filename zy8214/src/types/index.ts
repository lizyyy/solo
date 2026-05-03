export interface Fixture {
  id: string;
  name: string;
  channels: Channel[];
  universe?: number;
}

export interface Channel {
  id: string;
  name: string;
  dmxAddress: number;
  type: ChannelType;
  fixtureId: string;
}

export type ChannelType = 
  | 'dimmer' 
  | 'red' | 'green' | 'blue' | 'white' | 'amber' | 'uv'
  | 'pan' | 'tilt'
  | 'gobo' | 'color' | 'strobe'
  | 'safety'
  | 'other';

export interface Cue {
  id: string;
  number: string;
  name: string;
  startTime: number;
  fadeIn: number;
  fadeOut: number;
  duration: number;
  channelValues: ChannelValue[];
  notes?: string;
}

export interface ChannelValue {
  channelId: string;
  value: number;
  previousValue?: number;
}

export interface SceneRules {
  blackoutThreshold: number;
  requiresSafetyLight: boolean;
  safetyLightChannels: string[];
  maxFadeOverlap: number;
}

export interface Risk {
  id: string;
  type: RiskType;
  severity: RiskSeverity;
  cueId: string;
  cueNumber: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: number;
}

export type RiskType = 
  | 'channel_conflict'
  | 'fade_overlap'
  | 'excessive_blackout'
  | 'missing_safety_light'
  | 'invalid_value'
  | 'missing_fixture';

export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  selectedCueId: string | null;
  zoomLevel: number;
}

export interface AppState {
  fixtures: Fixture[];
  cues: Cue[];
  rules: SceneRules;
  risks: Risk[];
  timeline: TimelineState;
  activeChannelValues: Map<string, number>;
  dataLoaded: boolean;
}

export interface ParsingError {
  type: 'json' | 'csv' | 'yaml';
  message: string;
  row?: number;
  field?: string;
}