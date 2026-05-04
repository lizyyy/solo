export interface Project {
  id: string;
  name: string;
  venue: string;
  createdAt: string;
  updatedAt: string;
}

export interface Fixture {
  id: string;
  projectId: string;
  name: string;
  type: string;
  dmxStartAddress: number;
  dmxChannelCount: number;
  universe: number;
  power: number;
  circuitId: string | null;
  note: string | null;
}

export interface Cue {
  id: string;
  projectId: string;
  cueNumber: string;
  name: string;
  description: string;
  mediaReferences: string[];
  note: string | null;
}

export interface Circuit {
  id: string;
  projectId: string;
  name: string;
  maxPower: number;
  description: string;
  note: string | null;
}

export interface MediaFile {
  id: string;
  projectId: string;
  name: string;
  path: string;
  size: number;
  fileType: string;
}

export interface BannedDevice {
  id: string;
  projectId: string;
  name: string;
  reason: string;
}

export interface Issue {
  id: string;
  projectId: string;
  type: IssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  affectedItems: string[];
  resolved: boolean;
  resolutionNote: string | null;
  createdAt: string;
}

export type IssueType = 
  | 'dmx_conflict' 
  | 'power_overload' 
  | 'missing_media' 
  | 'banned_device'
  | 'other';

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface ProjectSummary {
  project: Project;
  fixtureCount: number;
  cueCount: number;
  circuitCount: number;
  mediaCount: number;
  issueCount: number;
  unresolvedIssueCount: number;
}

export interface ImportOptions {
  projectId: string;
  dmxAddressCsv?: string;
  cueCsv?: string;
  circuitCsv?: string;
  mediaFolder?: string;
  bannedDevicesCsv?: string;
}
