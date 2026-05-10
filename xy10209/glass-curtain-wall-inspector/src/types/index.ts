export const DefectType = {
  CRACK: 'crack',
  LOOSENESS: 'looseness'
} as const;

export type DefectType = typeof DefectType[keyof typeof DefectType];

export const DefectStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  REINSPECTED: 'reinspected',
  CLOSED: 'closed'
} as const;

export type DefectStatus = typeof DefectStatus[keyof typeof DefectStatus];

export interface Building {
  id: string;
  name: string;
  floors: number;
  columns: number;
  description?: string;
}

export interface GridCell {
  floor: number;
  column: number;
  hasDefect: boolean;
}

export interface Photo {
  id: string;
  url: string;
  name: string;
  uploadedAt: number;
}

export interface Defect {
  id: string;
  buildingId: string;
  floor: number;
  column: number;
  type: DefectType;
  status: DefectStatus;
  description: string;
  photos: Photo[];
  createdAt: number;
  updatedAt: number;
  inspectionNote?: string;
  reinspectionNote?: string;
}

export interface ReinspectionRecord {
  id: string;
  defectId: string;
  previousStatus: DefectStatus;
  newStatus: DefectStatus;
  note: string;
  operator: string;
  timestamp: number;
}

export interface FilterOptions {
  buildingId?: string;
  status?: DefectStatus;
  type?: DefectType;
}
