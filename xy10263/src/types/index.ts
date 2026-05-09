export interface Player {
  id: string;
  name: string;
  role: string;
  description: string;
  color: string;
}

export type ClueStatus = 'found' | 'analyzed' | 'unresolved' | 'resolved';
export type ClueType = 'physical' | 'testimony' | 'document' | 'special';

export interface Clue {
  id: string;
  playerId: string;
  title: string;
  content: string;
  type: ClueType;
  status: ClueStatus;
  timelineTime: number;
  tags: string[];
  notes: string;
  connectedClueIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Conflict {
  id: string;
  type: 'time_conflict' | 'testimony_conflict' | 'logic_conflict';
  involvedClueIds: string[];
  description: string;
  resolved: boolean;
  resolvedNotes?: string;
}

export interface Gap {
  id: string;
  type: 'missing_clue' | 'timeline_gap' | 'unassigned';
  description: string;
  relatedPlayerId?: string;
  relatedTimeRange?: [number, number];
}

export interface Statistics {
  totalClues: number;
  cluesByPlayer: Record<string, number>;
  cluesByStatus: Record<ClueStatus, number>;
  cluesByType: Record<ClueType, number>;
  conflictsTotal: number;
  conflictsResolved: number;
  gapsTotal: number;
  timelineCoverage: number;
}

export interface ExportMeta {
  version: '1.0';
  generatedAt: number;
  dataHash: string;
  checksum: string;
}

export interface ExportData {
  meta: ExportMeta;
  players: Player[];
  clues: Clue[];
  conflicts: Conflict[];
  gaps: Gap[];
  statistics: Statistics;
}

export interface Workspace {
  id: string;
  name: string;
  scriptName: string;
  createdAt: number;
  updatedAt: number;
  players: Player[];
  clues: Clue[];
  conflicts: Conflict[];
  gaps: Gap[];
}

export type Action =
  | { type: 'ADD_PLAYER'; payload: Omit<Player, 'id'> }
  | { type: 'UPDATE_PLAYER'; payload: Player }
  | { type: 'REMOVE_PLAYER'; payload: string }
  | { type: 'ADD_CLUE'; payload: Omit<Clue, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_CLUE'; payload: Clue }
  | { type: 'REMOVE_CLUE'; payload: string }
  | { type: 'BATCH_ADD_CLUES'; payload: Omit<Clue, 'id' | 'createdAt' | 'updatedAt'>[] }
  | { type: 'RESOLVE_CONFLICT'; payload: { id: string; notes?: string } }
  | { type: 'SET_WORKSPACE'; payload: Workspace }
  | { type: 'LOAD_SAMPLE'; payload: Workspace }
  | { type: 'RESET_WORKSPACE' }
  | { type: 'IMPORT_DATA'; payload: Workspace }
  | { type: 'UPDATE_WORKSPACE_INFO'; payload: { name: string; scriptName: string } };
