import { TrainingSession, TrainingPlan, HandActionType } from '../src/shared/types';
import { ScoringEngine } from '../src/shared/ScoringEngine';
import { HAND_ACTIONS, DEFAULT_BPM, DEFAULT_BEATS_PER_MEASURE } from '../src/shared/constants';
import { generateId } from '../src/shared/utils';

describe('ScoringEngine', () => {
  const createTestPlan = (): TrainingPlan => ({
    id: generateId(),
    name: '测试方案',
    description: '测试用训练方案',
    bpm: DEFAULT_BPM,
    beatsPerMeasure: DEFAULT_BEATS_PER_MEASURE,
    repeatCount: 3,
    steps: [
      { id: generateId(), actionId: HAND_ACTIONS[0].id, beatCount: 4 },
      { id: generateId(), actionId: HAND_ACTIONS[1].id, beatCount: 4 },
      { id: generateId(), actionId: HAND_ACTIONS[2].id, beatCount: 4 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createTestSession = (
    correct: number,
    incorrect: number,
    missed: number,
    actionResults: Array<{
      stepIndex: number;
      expectedAction: HandActionType;
      actualAction: HandActionType | null;
      isCorrect: boolean;
      isMissed: boolean;
      timingOffsetMs: number;
    }> = []
  ): TrainingSession => {
    const now = Date.now();
    return {
      id: generateId(),
      planId: generateId(),
      planName: '测试方案',
      startTime: now - 60000,
      endTime: now,
      phase: 'completed',
      currentStepIndex: 3,
      currentBeat: 4,
      actionResults: actionResults.map((r) => ({
        ...r,
        timestamp: Date.now(),
      })),
      painRecords: [],
      pauseRecords: [],
      totalCorrect: correct,
      totalIncorrect: incorrect,
      totalMissed: missed,
      avgTimingOffset: actionResults.length > 0
        ? actionResults.filter(r => !r.isMissed && r.isCorrect)
            .reduce((sum, r) => sum + Math.abs(r.timingOffsetMs), 0) /
          Math.max(1, actionResults.filter(r => !r.isMissed && r.isCorrect).length)
        : 0,
    };
  };

  describe('calculateAccuracy', () => {
    it('should return 100% when all actions are correct', () => {
      const plan = createTestPlan();
      const session = createTestSession(10, 0, 0);
      const engine = new ScoringEngine(session, plan);
      
      expect(engine.calculateAccuracy()).toBe(100);
    });

    it('should return 0% when no actions are correct', () => {
      const plan = createTestPlan();
      const session = createTestSession(0, 5, 5);
      const engine = new ScoringEngine(session, plan);
      
      expect(engine.calculateAccuracy()).toBe(0);
    });

    it('should calculate accuracy correctly', () => {
      const plan = createTestPlan();
      const session = createTestSession(7, 2, 1);
      const engine = new ScoringEngine(session, plan);
      
      expect(engine.calculateAccuracy()).toBe(70);
    });

    it('should return 0% when there are no actions', () => {
      const plan = createTestPlan();
      const session = createTestSession(0, 0, 0);
      const engine = new ScoringEngine(session, plan);
      
      expect(engine.calculateAccuracy()).toBe(0);
    });
  });

  describe('calculateTimingScore', () => {
    it('should return 100 when timing is perfect', () => {
      const plan = createTestPlan();
      const session = createTestSession(5, 0, 0, [
        { stepIndex: 0, expectedAction: 'fist', actualAction: 'fist', isCorrect: true, isMissed: false, timingOffsetMs: 0 },
        { stepIndex: 1, expectedAction: 'palm', actualAction: 'palm', isCorrect: true, isMissed: false, timingOffsetMs: 50 },
        { stepIndex: 2, expectedAction: 'pinch', actualAction: 'pinch', isCorrect: true, isMissed: false, timingOffsetMs: -50 },
      ]);
      const engine = new ScoringEngine(session, plan);
      
      expect(engine.calculateTimingScore()).toBe(100);
    });

    it('should return 0 when timing is too far off', () => {
      const plan = createTestPlan();
      const session = createTestSession(3, 0, 0, [
        { stepIndex: 0, expectedAction: 'fist', actualAction: 'fist', isCorrect: true, isMissed: false, timingOffsetMs: 600 },
        { stepIndex: 1, expectedAction: 'palm', actualAction: 'palm', isCorrect: true, isMissed: false, timingOffsetMs: -600 },
      ]);
      const engine = new ScoringEngine(session, plan);
      
      expect(engine.calculateTimingScore()).toBe(0);
    });

    it('should return 100 when there are no valid results', () => {
      const plan = createTestPlan();
      const session = createTestSession(0, 5, 0, [
        { stepIndex: 0, expectedAction: 'fist', actualAction: 'palm', isCorrect: false, isMissed: false, timingOffsetMs: 0 },
      ]);
      const engine = new ScoringEngine(session, plan);
      
      expect(engine.calculateTimingScore()).toBe(0);
    });
  });

  describe('calculateOverallScore', () => {
    it('should calculate weighted average correctly', () => {
      const plan = createTestPlan();
      const session = createTestSession(8, 2, 0, [
        { stepIndex: 0, expectedAction: 'fist', actualAction: 'fist', isCorrect: true, isMissed: false, timingOffsetMs: 50 },
        { stepIndex: 1, expectedAction: 'palm', actualAction: 'palm', isCorrect: true, isMissed: false, timingOffsetMs: -50 },
      ]);
      const engine = new ScoringEngine(session, plan);
      
      const accuracy = engine.calculateAccuracy();
      const timing = engine.calculateTimingScore();
      const rhythm = engine.calculateRhythmScore();
      const overall = engine.calculateOverallScore();
      
      expect(overall).toBe(accuracy * 0.5 + timing * 0.3 + rhythm * 0.2);
    });
  });

  describe('getFullScore', () => {
    it('should return complete score object', () => {
      const plan = createTestPlan();
      const session = createTestSession(10, 0, 0);
      const engine = new ScoringEngine(session, plan);
      
      const score = engine.getFullScore();
      
      expect(score).toHaveProperty('accuracyPercentage');
      expect(score).toHaveProperty('timingScore');
      expect(score).toHaveProperty('rhythmScore');
      expect(score).toHaveProperty('overallScore');
      expect(score).toHaveProperty('totalActions');
      expect(score).toHaveProperty('correctActions');
      expect(score).toHaveProperty('missedActions');
    });
  });

  describe('getActionAccuracyByStep', () => {
    it('should return accuracy per step', () => {
      const plan = createTestPlan();
      const session = createTestSession(5, 2, 1, [
        { stepIndex: 0, expectedAction: 'fist', actualAction: 'fist', isCorrect: true, isMissed: false, timingOffsetMs: 0 },
        { stepIndex: 0, expectedAction: 'fist', actualAction: 'palm', isCorrect: false, isMissed: false, timingOffsetMs: 0 },
        { stepIndex: 1, expectedAction: 'palm', actualAction: 'palm', isCorrect: true, isMissed: false, timingOffsetMs: 0 },
        { stepIndex: 2, expectedAction: 'pinch', actualAction: null, isCorrect: false, isMissed: true, timingOffsetMs: 0 },
      ]);
      const engine = new ScoringEngine(session, plan);
      
      const stepStats = engine.getActionAccuracyByStep();
      
      expect(stepStats.size).toBe(3);
      expect(stepStats.get(0)?.accuracy).toBe(50);
      expect(stepStats.get(1)?.accuracy).toBe(100);
      expect(stepStats.get(2)?.accuracy).toBe(0);
    });
  });

  describe('getActionTypeStats', () => {
    it('should return stats per action type', () => {
      const plan = createTestPlan();
      const session = createTestSession(6, 2, 1, [
        { stepIndex: 0, expectedAction: 'fist', actualAction: 'fist', isCorrect: true, isMissed: false, timingOffsetMs: 0 },
        { stepIndex: 0, expectedAction: 'fist', actualAction: 'fist', isCorrect: true, isMissed: false, timingOffsetMs: 0 },
        { stepIndex: 1, expectedAction: 'palm', actualAction: 'palm', isCorrect: true, isMissed: false, timingOffsetMs: 0 },
        { stepIndex: 1, expectedAction: 'palm', actualAction: 'fist', isCorrect: false, isMissed: false, timingOffsetMs: 0 },
        { stepIndex: 2, expectedAction: 'pinch', actualAction: 'pinch', isCorrect: true, isMissed: false, timingOffsetMs: 0 },
      ]);
      const engine = new ScoringEngine(session, plan);
      
      const typeStats = engine.getActionTypeStats();
      
      expect(typeStats.get('fist')?.accuracy).toBe(100);
      expect(typeStats.get('palm')?.accuracy).toBe(50);
    });
  });

  describe('getPainSummary', () => {
    it('should return empty summary when no pain records', () => {
      const plan = createTestPlan();
      const session = createTestSession(10, 0, 0);
      const engine = new ScoringEngine(session, plan);
      
      const summary = engine.getPainSummary();
      
      expect(summary.totalRecords).toBe(0);
      expect(summary.maxIntensity).toBe(0);
      expect(summary.avgIntensity).toBe(0);
    });

    it('should return correct pain summary', () => {
      const plan = createTestPlan();
      const session = createTestSession(10, 0, 0);
      session.painRecords = [
        { timestamp: Date.now(), stepIndex: 0, intensity: 2 },
        { timestamp: Date.now(), stepIndex: 1, intensity: 4 },
        { timestamp: Date.now(), stepIndex: 2, intensity: 3 },
      ];
      const engine = new ScoringEngine(session, plan);
      
      const summary = engine.getPainSummary();
      
      expect(summary.totalRecords).toBe(3);
      expect(summary.maxIntensity).toBe(4);
      expect(summary.avgIntensity).toBe(3);
    });
  });

  describe('getPauseSummary', () => {
    it('should return empty summary when no pause records', () => {
      const plan = createTestPlan();
      const session = createTestSession(10, 0, 0);
      const engine = new ScoringEngine(session, plan);
      
      const summary = engine.getPauseSummary();
      
      expect(summary.totalPauses).toBe(0);
    });

    it('should return correct pause summary', () => {
      const plan = createTestPlan();
      const session = createTestSession(10, 0, 0);
      const now = Date.now();
      session.pauseRecords = [
        { startTime: now - 10000, endTime: now - 5000, stepIndex: 0, reason: '休息' },
        { startTime: now - 3000, endTime: now - 1000, stepIndex: 1 },
      ];
      const engine = new ScoringEngine(session, plan);
      
      const summary = engine.getPauseSummary();
      
      expect(summary.totalPauses).toBe(2);
      expect(summary.totalPauseDuration).toBe(7000);
      expect(summary.avgPauseDuration).toBe(3500);
    });
  });
});
