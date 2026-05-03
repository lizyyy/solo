export interface Scene {
  id: string;
  sceneNumber: string;
  description: string;
  date: string;
  timeOfDay: string;
  location: string;
  interiorExterior: 'INT' | 'EXT';
  plannedShootDate: string;
  actualShootDate?: string;
  reshootDate?: string;
  notes?: string;
}

export interface Prop {
  id: string;
  propNumber: string;
  name: string;
  description: string;
  category: string;
  responsiblePerson: string;
  status: string;
  currentLocation: string;
  photos: string[];
  notes?: string;
}

export interface PropAppearance {
  id: string;
  propId: string;
  sceneId: string;
  position: string;
  state: string;
  condition: string;
  photos: string[];
  notes?: string;
  timestamp: number;
}

export interface ContinuityRule {
  id: string;
  ruleType: string;
  name: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
}

export interface ContinuityIssue {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  propId?: string;
  propName?: string;
  sceneId?: string;
  sceneNumber?: string;
  relatedItems: string[];
  timestamp: number;
}

export interface ConfirmedIssue {
  id: string;
  issueId: string;
  confirmedBy: string;
  confirmedAt: number;
  notes?: string;
}

export interface ReviewReport {
  projectName: string;
  generatedAt: string;
  totalScenes: number;
  totalProps: number;
  issuesFound: number;
  criticalIssues: number;
  warningIssues: number;
  confirmedIssues: number;
  issues: ContinuityIssue[];
  confirmedIssuesList: ConfirmedIssue[];
  summary: string;
}

export interface ImportResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
}
