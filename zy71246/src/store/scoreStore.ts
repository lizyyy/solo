import { create } from 'zustand';
import type { MissionReport, ScoreDetail, GameState, EventLog } from '../types/mission';
import { calculateFinalScore } from '../engine/scoreEngine';
import { saveReport, loadSavedReports, loadReport } from '../utils/export';

interface ScoreStore {
  currentScore: number;
  report: MissionReport | null;
  currentReport: MissionReport | null;
  savedReports: MissionReport[];
  isGenerating: boolean;
  generateReport: (gameState: GameState, events: EventLog[]) => MissionReport;
  setCurrentReport: (report: MissionReport) => void;
  saveCurrentReport: () => void;
  loadSavedReports: () => void;
  loadReportById: (missionId: string) => MissionReport | null;
  clearReport: () => void;
  setCurrentScore: (score: number) => void;
  getScoreBreakdown: () => ScoreDetail[] | null;
}

export const useScoreStore = create<ScoreStore>((set, get) => ({
  currentScore: 0,
  report: null,
  currentReport: null,
  savedReports: [],
  isGenerating: false,

  generateReport: (gameState, events) => {
    set({ isGenerating: true });
    const report = calculateFinalScore(gameState, events);
    set({ report, currentReport: report, isGenerating: false, currentScore: report.finalScore });
    return report;
  },

  setCurrentReport: (report) => {
    set({ currentReport: report, report });
  },

  saveCurrentReport: () => {
    const { report, currentReport } = get();
    const reportToSave = currentReport || report;
    if (reportToSave) {
      saveReport(reportToSave);
      get().loadSavedReports();
    }
  },

  loadSavedReports: () => {
    const reports = loadSavedReports();
    set({ savedReports: reports });
  },

  loadReportById: (reportId) => {
    const report = loadReport(reportId);
    if (report) {
      set({ report, currentReport: report, currentScore: report.finalScore });
    }
    return report;
  },

  clearReport: () => set({ report: null, currentReport: null, currentScore: 0 }),

  setCurrentScore: (score) => set({ currentScore: score }),

  getScoreBreakdown: () => {
    const { report, currentReport } = get();
    return (currentReport || report)?.scoreDetails || null;
  },
}));
