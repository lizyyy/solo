export type KnowledgeStatus = 'confirmed' | 'pending' | 'modified';

export type OperationAction = 'import' | 'edit' | 'undo' | 'export' | 'status_change' | 'skip';

export type DataType = 'script' | 'part' | 'note' | 'knowledge';

export interface ProcessingInfo {
  rule: string;
  timestamp: string;
  operator: string;
  version: string;
}

export interface DemoScript {
  id: string;
  title: string;
  content: string;
  stepNumber: number;
  sourceFile: string;
  importedAt: string;
  processingRule: string;
  version: string;
  isSkipped: boolean;
  skipReason?: string;
}

export interface Part {
  id: string;
  name: string;
  partNumber: string;
  quantity: number;
  description: string;
  category: string;
  sourceFile: string;
  importedAt: string;
  processingRule: string;
  version: string;
}

export interface Note {
  id: string;
  content: string;
  relatedTo: string;
  author: string;
  createdAt: string;
  processingRule: string;
}

export interface KnowledgePoint {
  id: string;
  title: string;
  content: string;
  status: KnowledgeStatus;
  scriptReferences: string[];
  partReferences: string[];
  noteReferences: string[];
  createdAt: string;
  updatedAt: string;
  processingRule: string;
  manualEditReason?: string;
  undoHighlight?: boolean;
}

export interface OperationLog {
  id: string;
  action: OperationAction;
  targetId: string;
  targetType: DataType;
  timestamp: string;
  operator: string;
  processingRule: string;
  beforeState?: string;
  afterState?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  duplicates: number;
  message: string;
}

export interface ExportFilters {
  status?: KnowledgeStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  processingRule?: string;
}
