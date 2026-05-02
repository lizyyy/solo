export interface Client {
  id: string;
  name: string;
  color: string;
}

export interface Operation {
  id: string;
  clientId: string;
  timestamp: number;
  type: 'insert' | 'delete' | 'undo';
  position: number;
  char?: string;
  targetOpId?: string;
}

export interface RGACharacter {
  id: string;
  char: string;
  prevId: string | null;
  nextId: string | null;
  deleted: boolean;
  clientId: string;
  timestamp: number;
}

export interface Conflict {
  type: 'concurrent_insert' | 'invalid_delete' | 'undo_not_found';
  op: Operation;
  description: string;
  affectedClients: string[];
}

export interface PlaybackResult {
  finalDocument: string;
  conflicts: Conflict[];
  operations: Operation[];
  clientMap: Map<string, Client>;
}

export interface TimelineEvent {
  operation: Operation;
  client: Client;
  documentState: string;
  conflict?: Conflict;
}