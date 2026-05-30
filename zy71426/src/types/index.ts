export type CaseType = 'vehicle' | 'property' | 'liability' | 'health';
export type CaseStatus = 'pending' | 'in_progress' | 'completed' | 'passed' | 'failed';
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ConclusionType = 'approve' | 'reject' | 'supplement';
export type EvidenceType = 'accident' | 'clause' | 'photo';
export type MarkType = 'suspicious' | 'contradiction' | 'exemption' | 'old_damage';
export type ChangeType = 'new' | 'modified' | 'duplicate';
export type Severity = 'minor' | 'major' | 'critical';
export type ActiveTool = 'highlight' | 'stamp' | 'note' | null;

export interface AccidentCard {
  id: string;
  caseId: string;
  mainInfo: string;
  accidentTime: string;
  location: string;
  description: string;
  reporter: string;
  claimAmount: number;
}

export interface PolicyClause {
  id: string;
  caseId: string;
  clauseNo: string;
  content: string;
  type: 'coverage' | 'exemption' | 'definition';
  isExemption: boolean;
  relatedEvidenceIds: string[];
}

export interface PhotoEvidence {
  id: string;
  caseId: string;
  imageUrl: string;
  description: string;
  shootingTime: string;
  shootingLocation: string;
  isNewDamage: boolean | null;
  contradictions: string[];
  version: number;
  isUpdate: boolean;
  updateNote: string;
}

export interface UpdatedItem {
  type: EvidenceType;
  itemId: string;
  changeType: ChangeType;
  diffContent: string;
}

export interface MaterialUpdate {
  id: string;
  caseId: string;
  updateTime: string;
  updatedItems: UpdatedItem[];
}

export interface RequiredMark {
  evidenceType: EvidenceType;
  evidenceId: string;
  markType: MarkType;
  explanation: string;
}

export interface CommonMistake {
  mistakeType: string;
  description: string;
  consequence: string;
  ruleBasis: string;
}

export interface CorrectAnswer {
  requiredMarks: RequiredMark[];
  riskScore: number;
  conclusion: ConclusionType;
  supplementReasons: string[];
  commonMistakes: CommonMistake[];
}

export interface Case {
  id: string;
  title: string;
  type: CaseType;
  difficulty: DifficultyLevel;
  status: CaseStatus;
  accidentCard: AccidentCard;
  policyClauses: PolicyClause[];
  photoEvidence: PhotoEvidence[];
  materialUpdates: MaterialUpdate[];
  correctAnswer: CorrectAnswer;
}

export interface EvidenceMark {
  id: string;
  caseId: string;
  evidenceType: EvidenceType;
  evidenceId: string;
  markType: MarkType;
  note: string;
  matchedClauseId?: string;
  timestamp: number;
}

export interface RiskAssessment {
  caseId: string;
  score: number;
  level: RiskLevel;
  conclusion: ConclusionType;
  supplementReasons: string[];
  riskPoints: string[];
}

export interface ActionItem {
  timestamp: number;
  actionType: string;
  payload: any;
  snapshot: any;
}

export interface PlaybackRecord {
  caseId: string;
  actionTimeline: ActionItem[];
  startTime: number;
  endTime: number;
}

export interface CaseSummary {
  title: string;
  accidentTime: string;
  location: string;
  claimAmount: number;
}

export interface EvidenceAnalysis {
  evidenceType: string;
  evidenceId: string;
  description: string;
  playerMark: string;
  correctMark: string;
  isCorrect: boolean;
}

export interface ClauseMatch {
  clauseId: string;
  clauseNo: string;
  playerMatched: boolean;
  shouldMatch: boolean;
  explanation: string;
}

export interface MistakeItem {
  type: string;
  description: string;
  ruleBasis: string;
  severity: Severity;
}

export interface PlayerPerformance {
  totalPoints: number;
  earnedPoints: number;
  accuracy: number;
  timeSpent: number;
  strengths: string[];
  improvements: string[];
}

export interface InvestigationReport {
  id: string;
  caseId: string;
  caseSummary: CaseSummary;
  evidenceAnalysis: EvidenceAnalysis[];
  clauseMatches: ClauseMatch[];
  errorsFound: MistakeItem[];
  riskAssessment: RiskAssessment;
  playerPerformance: PlayerPerformance;
  finalConclusion: string;
  generatedAt: number;
}

export interface GameState {
  currentCaseId: string | null;
  cases: Case[];
  evidenceMarks: EvidenceMark[];
  riskAssessment: RiskAssessment | null;
  playbackRecord: PlaybackRecord | null;
  activeTool: ActiveTool;
  selectedClauseId: string | null;
  showMaterialUpdate: boolean;
  currentUpdateIndex: number;
  isPlaybackMode: boolean;
  playbackStep: number;
  gameStartTime: number | null;
}

export interface GameActions {
  setCurrentCase: (caseId: string) => void;
  loadCases: () => void;
  addEvidenceMark: (mark: Omit<EvidenceMark, 'id' | 'timestamp'>) => void;
  removeEvidenceMark: (markId: string) => void;
  updateRiskAssessment: (assessment: Partial<RiskAssessment>) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setSelectedClauseId: (clauseId: string | null) => void;
  matchClauseToEvidence: (markId: string, clauseId: string) => void;
  submitJudgment: () => { isCorrect: boolean; score: number };
  startPlayback: (caseId: string) => void;
  stopPlayback: () => void;
  setPlaybackStep: (step: number) => void;
  recordAction: (actionType: string, payload: any, customSnapshot?: any) => void;
  triggerMaterialUpdate: () => void;
  acceptMaterialUpdate: () => void;
  rejectMaterialUpdate: () => void;
  generateReport: (caseId: string) => InvestigationReport;
  exportReport: (caseId: string) => void;
  resetCase: (caseId: string) => void;
  getCaseHistory: () => Case[];
}

export type GameStore = GameState & GameActions;
