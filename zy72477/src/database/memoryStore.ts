import {
  EmergencyShelter, RedLineMap, GridInspectorReport, ConflictRecord,
  SelfCheckResult, CalculationParam, CapacityCheckResult, WorkflowRecord, ExportRecord
} from '../types';

export interface DataStore {
  shelters: EmergencyShelter[];
  redLineMaps: RedLineMap[];
  inspectorReports: GridInspectorReport[];
  conflictRecords: ConflictRecord[];
  selfCheckResults: SelfCheckResult[];
  calculationParams: CalculationParam[];
  capacityCheckResults: CapacityCheckResult[];
  workflowRecords: WorkflowRecord[];
  exportRecords: ExportRecord[];
}

const store: DataStore = {
  shelters: [],
  redLineMaps: [],
  inspectorReports: [],
  conflictRecords: [],
  selfCheckResults: [],
  calculationParams: [],
  capacityCheckResults: [],
  workflowRecords: [],
  exportRecords: []
};

export const getStore = (): DataStore => store;

export const resetStore = (): void => {
  store.shelters = [];
  store.redLineMaps = [];
  store.inspectorReports = [];
  store.conflictRecords = [];
  store.selfCheckResults = [];
  store.calculationParams = [];
  store.capacityCheckResults = [];
  store.workflowRecords = [];
  store.exportRecords = [];
};
