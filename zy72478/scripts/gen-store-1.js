
const fs = require('fs');
const path = require('path');

const part1 = `import { create } from 'zustand';
import * as XLSX from 'xlsx';
import type {
  Project,
  BusSwipeRecord,
  RedlineNote,
  HeatmapData,
  ConflictRecord,
  SelfCheckResult,
  OperationLog,
  TodoItem,
  ConflictStatus,
  SelfCheckStatus,
  DataChangeRecord,
  FieldChange,
  ImportResult,
  ExportResult,
  HeatmapExportRow,
  HistoryExportRow,
  DataSource,
  HeatmapPoint,
} from '../../shared/types';
import {
  mockProjects,
  mockBusSwipes,
  mockRedlineNotes,
  mockHeatmapData,
  mockConflicts,
  mockSelfChecks,
  mockOperationLogs,
  mockTodos,
  generateHeatmapPointsFromBusSwipes,
  AREA_COORDINATE_MAP,
  LOCATION_TO_AREA,
  calculateHeatValue,
} from '../data/mockData';

interface AppState {
  currentProject: Project | null;
  projects: Project[];
  busSwipes: BusSwipeRecord[];
  redlineNotes: RedlineNote[];
  heatmapData: HeatmapData[];
  conflicts: ConflictRecord[];
  selfChecks: SelfCheckResult[];
  operationLogs: OperationLog[];
  dataChangeHistory: DataChangeRecord[];
  todos: TodoItem[];
  selectedHeatmapVersion: string | null;
  currentUser: string;
  lastExportResult: ExportResult | null;
  setCurrentProject: (project: Project) => void;
  parseCsvFile: (file: File) => Promise<Partial<BusSwipeRecord>[]>;
  parseExcelFile: (file: File) => Promise<Partial<BusSwipeRecord>[]>;
  addBusSwipes: (records: Partial<BusSwipeRecord>[], sourceFile?: string, parseMethod?: 'csv' | 'xlsx') => ImportResult;
  addRedlineNote: (note: Partial<RedlineNote>) => void;
  updateRedlineNote: (id: string, updates: Partial<RedlineNote>, reason: string) => void;
  resolveConflict: (id: string, status: ConflictStatus, operator: string) => void;
  runSelfCheck: (type: string) => SelfCheckResult;
  runAllSelfChecks: () => void;
  recalculateHeatmap: (source?: 'supplement' | 'manual', sourceBusIds?: string[]) => string | null;
  detectConflicts: (newBusIds?: string[], newRedlineIds?: string[]) => ConflictRecord[];
  addOperationLog: (action: string, details: string) => void;
  addDataChange: (change: Omit<DataChangeRecord, 'id' | 'createdAt' | 'operator' | 'projectId'>) => void;
  toggleTodo: (id: string) => void;
  setSelectedHeatmapVersion: (version: string) => void;
  exportHeatmap: (heatmapId: string) => ExportResult;
  exportHistory: () => ExportResult;
  verifyEvidenceChain: (busSwipeId: string) => any;
}
`;

const target = path.resolve(__dirname, '../src/store/appStore.ts');
fs.writeFileSync(target, part1);
console.log('Part 1 written, lines:', part1.split('\n').length);
