import { create } from 'zustand';
import type { TaskSequence, Command, Anomaly, RecalculateResult, BriefingData } from '../types';
import { sampleSequence } from '../mock/sampleData';
import { AnomalyDetector, type DetectionResult } from '../services/anomalyDetector';
import { SequenceRecalculator } from '../services/recalculator';
import { TimeService } from '../services/timeService';

interface SequenceState {
  sequence: TaskSequence;
  selectedCommandId: string | null;
  anomalies: Anomaly[];
  anomalySummary: DetectionResult['summary'];
  detectionResult: DetectionResult | null;
  recalculator: SequenceRecalculator | null;
  recalculateResult: RecalculateResult | null;
  affectedCommandIds: string[];
  isRecalculating: boolean;
  showRecalculateReport: boolean;

  initSequence: () => void;
  setSequence: (sequence: TaskSequence) => void;
  selectCommand: (commandId: string | null) => void;
  detectAnomalies: () => void;
  runDetection: () => void;
  undoLastAdjustment: () => void;
  clearRecalculateResult: () => void;
  closeRecalculateReport: () => void;
  generateBriefingData: () => BriefingData;
}

export const useSequenceStore = create<SequenceState>((set, get) => ({
  sequence: sampleSequence,
  selectedCommandId: null,
  anomalies: [],
  anomalySummary: {
    windowOverlap: 0,
    telemetryMissing: 0,
    manualInsert: 0,
  },
  detectionResult: null,
  recalculator: null,
  recalculateResult: null,
  affectedCommandIds: [],
  isRecalculating: false,
  showRecalculateReport: false,

  initSequence: () => {
    const sequence = JSON.parse(JSON.stringify(sampleSequence)) as TaskSequence;
    const recalculator = new SequenceRecalculator(sequence.missionStartTime);

    sequence.adjustments.forEach(adj => {
      recalculator.pushToHistory(sequence, adj);
    });

    set({ sequence, recalculator });
    get().detectAnomalies();
  },

  setSequence: (sequence: TaskSequence) => {
    set({ sequence });
    get().detectAnomalies();
  },

  selectCommand: (commandId: string | null) => {
    set({ selectedCommandId: commandId });
  },

  detectAnomalies: () => {
    const { sequence } = get();
    const detector = new AnomalyDetector(sequence.missionStartTime);
    const result = detector.detect(sequence);

    const commandsWithAnomalies = sequence.commands.map(cmd => {
      const cmdAnomalies = result.anomalies.filter(a => a.commandId === cmd.id);
      return {
        ...cmd,
        anomaly: cmdAnomalies.length > 0 ? cmdAnomalies[0] : undefined,
      };
    });

    set({
      sequence: {
        ...sequence,
        commands: commandsWithAnomalies,
      },
      anomalies: result.anomalies,
      anomalySummary: result.summary,
      detectionResult: result,
    });
  },

  runDetection: () => {
    get().detectAnomalies();
  },

  undoLastAdjustment: () => {
    const { sequence, recalculator } = get();
    if (!recalculator || !recalculator.canUndo()) return;

    set({ isRecalculating: true, affectedCommandIds: [] });

    setTimeout(() => {
      const result = recalculator.undoLastAdjustment(sequence);
      if (result) {
        const detector = new AnomalyDetector(result.sequence.missionStartTime);
        const detectionResult = detector.detect(result.sequence);

        const commandsWithAnomalies = result.sequence.commands.map(cmd => {
          const cmdAnomalies = detectionResult.anomalies.filter(a => a.commandId === cmd.id);
          return {
            ...cmd,
            anomaly: cmdAnomalies.length > 0 ? cmdAnomalies[0] : undefined,
          };
        });

        set({
          sequence: {
            ...result.sequence,
            commands: commandsWithAnomalies,
          },
          anomalies: detectionResult.anomalies,
          anomalySummary: detectionResult.summary,
          detectionResult,
          recalculateResult: result.result,
          affectedCommandIds: result.result.affectedCommands,
          isRecalculating: false,
          showRecalculateReport: true,
        });

        setTimeout(() => {
          set({ affectedCommandIds: [] });
        }, 5000);
      } else {
        set({ isRecalculating: false });
      }
    }, 500);
  },

  clearRecalculateResult: () => {
    set({ recalculateResult: null, showRecalculateReport: false });
  },

  closeRecalculateReport: () => {
    set({ showRecalculateReport: false });
  },

  generateBriefingData: (): BriefingData => {
    const { sequence, anomalies, anomalySummary } = get();

    const criticalAnomalies = anomalies.filter(
      a => a.severity === 'CRITICAL' || a.severity === 'WARNING'
    );

    const suggestions = anomalies.map(a => a.suggestion);

    return {
      missionName: sequence.missionName,
      sequenceName: sequence.name,
      generateTime: new Date(),
      totalCommands: sequence.commands.length,
      anomalySummary,
      criticalAnomalies,
      adjustmentHistory: sequence.adjustments,
      suggestions: [...new Set(suggestions)],
    };
  },
}));
