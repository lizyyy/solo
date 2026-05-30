import type { Point3D, DataMaterial, FilterRange } from './surface';
import type { DiagnosisIssue } from './diagnosis';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  description: string;
  parameters: Record<string, any>;
  viewState: {
    cameraPosition: Point3D;
    cameraTarget: Point3D;
    filterRange: FilterRange;
  };
  materialsSnapshot: DataMaterial[];
  issuesSnapshot: DiagnosisIssue[];
  note?: string;
}

export interface ReviewSession {
  id: string;
  name: string;
  createdAt: number;
  entries: HistoryEntry[];
  currentEntryIndex: number;
}
