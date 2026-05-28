export interface FieldFlags {
  clientIdMissing: boolean;
  varietyCodeMissing: boolean;
  contractMonthMissing: boolean;
  directionMissing: boolean;
  marginMissing: boolean;
  riskReportMissing: boolean;
}

export interface PositionRecord {
  id: string;
  clientId: string;
  clientName: string | null;
  varietyCode: string;
  varietyName: string | null;
  contractMonth: string | null;
  direction: "long" | "short" | null;
  margin: number | null;
  quantity: number | null;
  riskReport: string | null;
  fieldFlags: FieldFlags;
}

export interface CrossMonthWarning {
  clientId: string;
  varietyCode: string;
  fromMonth: string;
  toMonth: string;
  netChangePercent: number;
}

export interface ClientMergeIssue {
  clientName: string;
  distinctIds: string[];
}

export interface DuplicateMarginEntry {
  clientId: string;
  varietyCode: string;
  contractMonth: string;
  direction: string;
  duplicateCount: number;
  marginAmount: number;
}

export interface ValidationResult {
  id: string;
  timestamp: number;
  dataHash: string;
  crossMonthRollWarnings: CrossMonthWarning[];
  clientMergeIssues: ClientMergeIssue[];
  duplicateMarginEntries: DuplicateMarginEntry[];
}

export interface AggregatedBlock {
  varietyCode: string;
  varietyName: string;
  contractMonth: string;
  direction: "long" | "short" | "missing";
  clientId: string;
  clientName: string;
  totalMargin: number;
  totalQuantity: number;
  recordIds: string[];
  hasMissingFields: boolean;
  fieldFlags: FieldFlags;
  duplicateMargin: number;
  duplicateCount: number;
}

export interface FilterState {
  varieties: string[];
  months: string[];
  directions: ("long" | "short" | "missing")[];
  clientSearch: string;
}

export interface ExportRecord {
  id: string;
  timestamp: number;
  filterSnapshot: FilterState;
  dataHash: string;
  fileName: string;
  format: "csv" | "png";
}
