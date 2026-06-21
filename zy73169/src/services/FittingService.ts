import type { FittingSession, FittingMethod, FittingResult, SampleSource, Sample } from '../models/types';
import { createFittingSession } from '../models/factories';
import { calculateFitting, formatEquation } from '../algorithms/fitting';
import { detectAllAnomalies, getAnomalySummary, isolateAnomalousSamples } from '../algorithms/anomalyDetection';
import {
  addSample,
  confirmSample,
  correctSampleValue,
  withdrawSample,
  updateSampleField,
  getSampleChangeHistory,
  getSampleSourceInfo,
  getConfirmationDiffs,
  recalculateWithWithdrawn,
  verifyCalibrationConsistency,
  type ConfirmationDiff,
  type ConsistencyMismatch,
} from './traceability';

export interface PlaybackResult {
  session: FittingSession;
  fittingResult: FittingResult;
  equation: string;
  anomalySummary: Record<string, number>;
  isolatedSamples: { normal: Sample[]; anomalous: Sample[] };
}

export interface ReplayWithWithdrawnResult {
  before: {
    fittingResult: FittingResult;
    equation: string;
    rSquared: number;
  };
  after: {
    fittingResult: FittingResult;
    equation: string;
    rSquared: number;
  };
  diff: {
    rSquaredChange: number;
    coefficientChanges: Array<{ index: number; before: number; after: number; change: number }>;
  };
}

export class FittingService {
  private sessions: Map<string, FittingSession> = new Map();

  createSession(name: string, createdBy: string): FittingSession {
    const session = createFittingSession(name, createdBy);
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): FittingSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): FittingSession[] {
    return Array.from(this.sessions.values());
  }

  addSamples(sessionId: string, dataPoints: Array<{ x: number; y: number; source: SampleSource }>, addedBy: string): Sample[] {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');

    const samples: Sample[] = [];
    dataPoints.forEach(dp => {
      const sample = addSample(session, dp.x, dp.y, dp.source, addedBy);
      samples.push(sample);
    });

    return samples;
  }

  runFitting(
    sessionId: string,
    method: FittingMethod,
    calculatedBy: string,
    excludeAnomalies: boolean = true,
    degree?: number
  ): PlaybackResult {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');

    detectAllAnomalies(session.samples);

    const fittingResult = calculateFitting(session.samples, method, calculatedBy, excludeAnomalies, degree);
    session.fittingParams.push(fittingResult.params);
    session.activeFittingId = fittingResult.params.id;
    session.updatedAt = Date.now();

    const equation = formatEquation(fittingResult.params.coefficients, method, degree);
    const anomalySummary = getAnomalySummary(session.samples);
    const isolatedSamples = isolateAnomalousSamples(session.samples);

    return {
      session,
      fittingResult,
      equation,
      anomalySummary,
      isolatedSamples,
    };
  }

  confirmSample(sessionId: string, sampleId: string, confirmedBy: string, notes?: string): Sample | null {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');
    return confirmSample(session, sampleId, confirmedBy, notes);
  }

  correctSampleValue(
    sessionId: string,
    sampleId: string,
    field: 'x' | 'y',
    newValue: number,
    correctedBy: string,
    notes?: string
  ): Sample | null {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');
    return correctSampleValue(session, sampleId, field, newValue, correctedBy, notes);
  }

  withdrawSample(sessionId: string, sampleId: string, withdrawnBy: string, reason: string): Sample | null {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');
    return withdrawSample(session, sampleId, withdrawnBy, reason);
  }

  updateSample(
    sessionId: string,
    sampleId: string,
    field: keyof Sample,
    newValue: unknown,
    changedBy: string,
    reason?: string
  ): Sample | null {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');
    return updateSampleField(session, sampleId, field, newValue, changedBy, reason);
  }

  getSampleHistory(sessionId: string, sampleId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');
    return {
      history: getSampleChangeHistory(session, sampleId),
      sourceInfo: getSampleSourceInfo(session.samples.find(s => s.id === sampleId)!),
      confirmationDiffs: this.getConfirmationDiffs(sessionId, sampleId),
    };
  }

  getConfirmationDiffs(sessionId: string, sampleId: string): ConfirmationDiff[] {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');
    return getConfirmationDiffs(session, sampleId);
  }

  replayWithWithdrawn(
    sessionId: string,
    withdrawnSampleId: string,
    method: FittingMethod,
    calculatedBy: string,
    degree?: number
  ): ReplayWithWithdrawnResult | null {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');

    const result = recalculateWithWithdrawn(session, withdrawnSampleId, method, calculatedBy, degree);
    if (!result) return null;

    const beforeEquation = formatEquation(result.before.params.coefficients, method, degree);
    const afterEquation = formatEquation(result.after.params.coefficients, method, degree);

    const coefficientChanges = result.before.params.coefficients.map((before, index) => {
      const after = result.after.params.coefficients[index] || 0;
      return {
        index,
        before,
        after,
        change: after - before,
      };
    });

    return {
      before: {
        fittingResult: result.before,
        equation: beforeEquation,
        rSquared: result.before.params.rSquared,
      },
      after: {
        fittingResult: result.after,
        equation: afterEquation,
        rSquared: result.after.params.rSquared,
      },
      diff: {
        rSquaredChange: result.after.params.rSquared - result.before.params.rSquared,
        coefficientChanges,
      },
    };
  }

  verifyConsistency(sessionId: string, fittingId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');
    return verifyCalibrationConsistency(session, fittingId);
  }

  getAnomalySummary(sessionId: string): Record<string, number> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');
    return getAnomalySummary(session.samples);
  }
}

export const fittingService = new FittingService();
