import { create } from 'zustand';
import type { GameStore, EvidenceMark, RiskAssessment, Case } from '../types';
import { mockCases } from '../data/cases';
import {
  calculateRiskLevel,
  calculateScoreFromMarks,
  validateJudgment,
  checkConclusionCorrectness
} from '../utils/gameEngine';
import {
  createPlaybackRecord,
  recordAction,
  finishPlaybackRecord,
  savePlaybackToStorage,
  loadPlaybackFromStorage,
  seekToStep
} from '../utils/playbackManager';
import {
  generateReport,
  saveReportToStorage,
  exportReportToPDF
} from '../utils/reportGenerator';
import type { ActiveTool } from '../types';

const initialState: GameStore = {
  currentCaseId: null,
  cases: [],
  evidenceMarks: [],
  riskAssessment: null,
  playbackRecord: null,
  activeTool: null,
  selectedClauseId: null,
  showMaterialUpdate: false,
  currentUpdateIndex: 0,
  isPlaybackMode: false,
  playbackStep: 0,
  gameStartTime: null,
  setCurrentCase: () => {},
  loadCases: () => {},
  addEvidenceMark: () => {},
  removeEvidenceMark: () => {},
  updateRiskAssessment: () => {},
  setActiveTool: () => {},
  setSelectedClauseId: () => {},
  matchClauseToEvidence: () => {},
  submitJudgment: () => ({ isCorrect: false, score: 0 }),
  startPlayback: () => {},
  stopPlayback: () => {},
  setPlaybackStep: () => {},
  recordAction: () => {},
  triggerMaterialUpdate: () => {},
  acceptMaterialUpdate: () => {},
  rejectMaterialUpdate: () => {},
  generateReport: () => ({} as any),
  exportReport: () => {},
  resetCase: () => {},
  getCaseHistory: () => []
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  loadCases: () => {
    const storedCases = localStorage.getItem('gameCases');
    if (storedCases) {
      set({ cases: JSON.parse(storedCases) });
    } else {
      set({ cases: mockCases });
      localStorage.setItem('gameCases', JSON.stringify(mockCases));
    }
  },

  setCurrentCase: (caseId: string) => {
    const state = get();
    const caseData = state.cases.find(c => c.id === caseId);
    
    if (caseData) {
      const updatedCases = state.cases.map(c => 
        c.id === caseId ? { ...c, status: 'in_progress' as const } : c
      );
      
      set({
        currentCaseId: caseId,
        evidenceMarks: [],
        riskAssessment: {
          caseId,
          score: 0,
          level: 'low',
          conclusion: 'supplement',
          supplementReasons: [],
          riskPoints: []
        },
        playbackRecord: createPlaybackRecord(caseId),
        gameStartTime: Date.now(),
        showMaterialUpdate: false,
        currentUpdateIndex: 0,
        cases: updatedCases
      });
      
      localStorage.setItem('gameCases', JSON.stringify(updatedCases));
      
      get().recordAction('VIEW_ACCIDENT', { caseId }, { currentCaseId: caseId });
    }
  },

  addEvidenceMark: (mark: Omit<EvidenceMark, 'id' | 'timestamp'>) => {
    const state = get();
    const newMark: EvidenceMark = {
      ...mark,
      id: `mark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    const updatedMarks = [...state.evidenceMarks, newMark];
    
    set({ evidenceMarks: updatedMarks });
    get().recordAction('ADD_MARK', { mark: newMark }, { evidenceMarks: updatedMarks });
  },

  removeEvidenceMark: (markId: string) => {
    const state = get();
    const updatedMarks = state.evidenceMarks.filter(m => m.id !== markId);
    
    set({ evidenceMarks: updatedMarks });
    get().recordAction('REMOVE_MARK', { markId }, { evidenceMarks: updatedMarks });
  },

  updateRiskAssessment: (assessment: Partial<RiskAssessment>) => {
    const state = get();
    if (!state.riskAssessment) return;
    
    let updatedScore = assessment.score;
    let updatedLevel = state.riskAssessment.level;
    
    if (updatedScore !== undefined) {
      updatedLevel = calculateRiskLevel(updatedScore);
    }
    
    const updatedAssessment = {
      ...state.riskAssessment,
      ...assessment,
      level: updatedLevel
    };
    
    set({ riskAssessment: updatedAssessment });
    
    if (assessment.score !== undefined) {
      get().recordAction('UPDATE_RISK_SCORE', { score: assessment.score }, { riskAssessment: updatedAssessment });
    }
    if (assessment.conclusion) {
      get().recordAction('SET_CONCLUSION', { conclusion: assessment.conclusion }, { riskAssessment: updatedAssessment });
    }
  },

  setActiveTool: (tool: ActiveTool) => {
    set({ activeTool: tool });
  },

  setSelectedClauseId: (clauseId: string | null) => {
    set({ selectedClauseId: clauseId });
  },

  matchClauseToEvidence: (markId: string, clauseId: string) => {
    const state = get();
    const updatedMarks = state.evidenceMarks.map(m => 
      m.id === markId ? { ...m, matchedClauseId: clauseId } : m
    );
    
    set({ evidenceMarks: updatedMarks, selectedClauseId: null });
    get().recordAction('MATCH_CLAUSE', { markId, clauseId }, { evidenceMarks: updatedMarks });
  },

  submitJudgment: () => {
    const state = get();
    const currentCase = state.cases.find(c => c.id === state.currentCaseId);
    
    if (!currentCase || !state.riskAssessment) {
      return { isCorrect: false, score: 0 };
    }
    
    const validation = validateJudgment(currentCase, state.evidenceMarks, state.riskAssessment);
    if (!validation.isValid) {
      return { isCorrect: false, score: 0 };
    }
    
    const score = calculateScoreFromMarks(state.evidenceMarks, currentCase.correctAnswer);
    const conclusionCheck = checkConclusionCorrectness(
      state.riskAssessment.conclusion,
      currentCase.correctAnswer
    );
    
    const isCorrect = conclusionCheck.isCorrect && score >= 60;
    
    let updatedPlaybackRecord = state.playbackRecord;
    if (updatedPlaybackRecord) {
      updatedPlaybackRecord = finishPlaybackRecord(updatedPlaybackRecord);
      savePlaybackToStorage(updatedPlaybackRecord);
    }
    
    const updatedCases = state.cases.map(c => 
      c.id === state.currentCaseId 
        ? { ...c, status: isCorrect ? 'passed' as const : 'failed' as const } 
        : c
    );
    
    set({ 
      cases: updatedCases,
      playbackRecord: updatedPlaybackRecord
    });
    
    localStorage.setItem('gameCases', JSON.stringify(updatedCases));
    
    const report = get().generateReport(state.currentCaseId);
    saveReportToStorage(report);
    
    get().recordAction('SUBMIT_JUDGMENT', { isCorrect, score }, { 
      cases: updatedCases,
      playbackRecord: updatedPlaybackRecord
    });
    
    return { isCorrect, score };
  },

  startPlayback: (caseId: string) => {
    const playbackRecord = loadPlaybackFromStorage(caseId);
    if (playbackRecord) {
      set({
        isPlaybackMode: true,
        playbackStep: 0,
        playbackRecord,
        currentCaseId: caseId
      });
    }
  },

  stopPlayback: () => {
    set({
      isPlaybackMode: false,
      playbackStep: 0
    });
  },

  setPlaybackStep: (step: number) => {
    const state = get();
    if (!state.playbackRecord) return;
    
    const { state: playbackState } = seekToStep(state.playbackRecord, step);
    if (playbackState) {
      set({
        playbackStep: step,
        ...playbackState
      });
    }
  },

  recordAction: (actionType: string, payload: any, customSnapshot?: any) => {
    const state = get();
    if (state.isPlaybackMode || !state.playbackRecord) return;
    
    const snapshot = customSnapshot || {
      evidenceMarks: state.evidenceMarks,
      riskAssessment: state.riskAssessment,
      activeTool: state.activeTool,
      selectedClauseId: state.selectedClauseId
    };
    
    const updatedRecord = recordAction(state.playbackRecord, actionType, payload, snapshot);
    set({ playbackRecord: updatedRecord });
  },

  triggerMaterialUpdate: () => {
    const state = get();
    const currentCase = state.cases.find(c => c.id === state.currentCaseId);
    
    if (currentCase && currentCase.materialUpdates.length > state.currentUpdateIndex) {
      set({ showMaterialUpdate: true });
      get().recordAction('TRIGGER_MATERIAL_UPDATE', { 
        updateIndex: state.currentUpdateIndex 
      }, { showMaterialUpdate: true });
    }
  },

  acceptMaterialUpdate: () => {
    const state = get();
    const currentCase = state.cases.find(c => c.id === state.currentCaseId);
    
    if (!currentCase) return;
    
    const update = currentCase.materialUpdates[state.currentUpdateIndex];
    if (!update) return;
    
    const newPhotos = update.updatedItems
      .filter(item => item.type === 'photo' && item.changeType !== 'duplicate')
      .map(item => ({
        id: item.itemId,
        caseId: state.currentCaseId!,
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=document%20paper%20report%20official&image_size=square_hd',
        description: item.diffContent,
        shootingTime: update.updateTime,
        shootingLocation: '补传材料',
        isNewDamage: null,
        contradictions: [],
        version: 2,
        isUpdate: true,
        updateNote: item.diffContent
      }));
    
    const updatedCase = {
      ...currentCase,
      photoEvidence: [...currentCase.photoEvidence, ...newPhotos]
    };
    
    const updatedCases = state.cases.map(c => 
      c.id === state.currentCaseId ? updatedCase : c
    );
    
    set({
      cases: updatedCases,
      showMaterialUpdate: false,
      currentUpdateIndex: state.currentUpdateIndex + 1
    });
    
    localStorage.setItem('gameCases', JSON.stringify(updatedCases));
    
    get().recordAction('ACCEPT_MATERIAL_UPDATE', { 
      update, 
      newPhotos 
    }, { 
      cases: updatedCases,
      showMaterialUpdate: false,
      currentUpdateIndex: state.currentUpdateIndex + 1
    });
  },

  rejectMaterialUpdate: () => {
    set({ showMaterialUpdate: false });
  },

  generateReport: (caseId: string) => {
    const state = get();
    const currentCase = state.cases.find(c => c.id === caseId);
    
    if (!currentCase) {
      throw new Error('Case not found');
    }
    
    return generateReport(
      currentCase,
      state.evidenceMarks,
      state.riskAssessment,
      state.playbackRecord
    );
  },

  exportReport: async (caseId: string) => {
    const report = get().generateReport(caseId);
    await exportReportToPDF(report, 'report-content');
  },

  resetCase: (caseId: string) => {
    const state = get();
    const updatedCases = state.cases.map(c => 
      c.id === caseId ? { ...c, status: 'pending' as const } : c
    );
    
    set({
      cases: updatedCases,
      currentCaseId: null,
      evidenceMarks: [],
      riskAssessment: null,
      playbackRecord: null,
      activeTool: null,
      selectedClauseId: null,
      showMaterialUpdate: false,
      currentUpdateIndex: 0,
      isPlaybackMode: false,
      playbackStep: 0,
      gameStartTime: null
    });
    
    localStorage.setItem('gameCases', JSON.stringify(updatedCases));
  },

  getCaseHistory: () => {
    const state = get();
    return state.cases.filter(c => c.status === 'passed' || c.status === 'failed');
  }
}));
