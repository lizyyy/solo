import { create } from 'zustand';
import type {
  VRSession,
  AccelerationSample,
  FrameSample,
  PoseSample,
  PlayerFeedback,
  CameraSegment,
  AnomalyEvent,
  RuleConfig,
  RiskScoreFormula,
} from '../types';
import {
  generateMockSession,
  generateMockSessionList,
  generateDefaultRules,
  generateDefaultScoreFormula,
} from '../mock/dataGenerator';
import { runAnomalyDetection } from '../services/anomalyDetection';
import { calculateRiskScore } from '../services/riskScoring';
import { applyFeedbackOffsets } from '../services/timeAlignment';

interface SessionState {
  sessionList: VRSession[];
  currentSessionId: string | null;
  currentSession: VRSession | null;
  accelerationData: AccelerationSample[];
  frameData: FrameSample[];
  poseData: PoseSample[];
  feedbackData: PlayerFeedback[];
  segmentData: CameraSegment[];
  anomalyData: AnomalyEvent[];
  rules: RuleConfig[];
  scoreFormula: RiskScoreFormula;
  isLoading: boolean;
  selectedAnomalyId: string | null;
  timeRange: { start: number; end: number } | null;

  loadSessionList: () => void;
  loadSession: (sessionId: string) => void;
  selectAnomaly: (anomalyId: string | null) => void;
  setTimeRange: (range: { start: number; end: number } | null) => void;
  updateAnomalyReview: (
    anomalyId: string,
    status: AnomalyEvent['reviewStatus'],
    notes?: string
  ) => void;
  updateRule: (ruleId: string, updates: Partial<RuleConfig>) => void;
  toggleRule: (ruleId: string) => void;
  reprocessAnomalies: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => {
  const initialMock = generateMockSession();
  const initialRules = generateDefaultRules();
  const initialFormula = generateDefaultScoreFormula();

  const anomaliesWithScores = initialMock.anomalyData.map((a) => ({
    ...a,
    riskScore: calculateRiskScore(a, initialRules, initialFormula),
  }));

  return {
    sessionList: generateMockSessionList(),
    currentSessionId: initialMock.session.id,
    currentSession: initialMock.session,
    accelerationData: initialMock.accelerationData,
    frameData: initialMock.frameData,
    poseData: initialMock.poseData,
    feedbackData: applyFeedbackOffsets(initialMock.feedbackData),
    segmentData: initialMock.segmentData,
    anomalyData: anomaliesWithScores,
    rules: initialRules,
    scoreFormula: initialFormula,
    isLoading: false,
    selectedAnomalyId: null,
    timeRange: null,

    loadSessionList: () => {
      set({ sessionList: generateMockSessionList() });
    },

    loadSession: (sessionId: string) => {
      set({ isLoading: true });

      setTimeout(() => {
        const mock = generateMockSession();
        const state = get();
        const anomaliesWithScores = mock.anomalyData.map((a) => ({
          ...a,
          sessionId,
          riskScore: calculateRiskScore(a, state.rules, state.scoreFormula),
        }));

        set({
          currentSessionId: sessionId,
          currentSession: { ...mock.session, id: sessionId },
          accelerationData: mock.accelerationData,
          frameData: mock.frameData,
          poseData: mock.poseData,
          feedbackData: applyFeedbackOffsets(mock.feedbackData),
          segmentData: mock.segmentData,
          anomalyData: anomaliesWithScores,
          selectedAnomalyId: null,
          timeRange: null,
          isLoading: false,
        });
      }, 500);
    },

    selectAnomaly: (anomalyId: string | null) => {
      set({ selectedAnomalyId: anomalyId });
    },

    setTimeRange: (range: { start: number; end: number } | null) => {
      set({ timeRange: range });
    },

    updateAnomalyReview: (
      anomalyId: string,
      status: AnomalyEvent['reviewStatus'],
      notes?: string
    ) => {
      const state = get();
      const updated = state.anomalyData.map((a) => {
        if (a.id === anomalyId) {
          return {
            ...a,
            reviewStatus: status,
            reviewNotes: notes ?? a.reviewNotes,
            reviewedBy: 'analyst_01',
            reviewedAt: Date.now(),
            riskScore: calculateRiskScore(
              { ...a, reviewStatus: status },
              state.rules,
              state.scoreFormula
            ),
          };
        }
        return a;
      });
      set({ anomalyData: updated });
    },

    updateRule: (ruleId: string, updates: Partial<RuleConfig>) => {
      const state = get();
      const updated = state.rules.map((r) =>
        r.id === ruleId ? { ...r, ...updates } : r
      );
      set({ rules: updated });
    },

    toggleRule: (ruleId: string) => {
      const state = get();
      const updated = state.rules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      );
      set({ rules: updated });
    },

    reprocessAnomalies: () => {
      const state = get();
      const result = runAnomalyDetection(
        state.accelerationData,
        state.frameData,
        state.poseData,
        state.feedbackData,
        state.rules
      );

      const withScores = result.anomalies.map((a) => ({
        ...a,
        sessionId: state.currentSessionId || '',
        riskScore: calculateRiskScore(a, state.rules, state.scoreFormula),
      }));

      set({ anomalyData: withScores });
    },
  };
});
