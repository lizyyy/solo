"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fittingService = exports.FittingService = void 0;
const factories_1 = require("../models/factories");
const fitting_1 = require("../algorithms/fitting");
const anomalyDetection_1 = require("../algorithms/anomalyDetection");
const traceability_1 = require("./traceability");
class FittingService {
    constructor() {
        this.sessions = new Map();
    }
    createSession(name, createdBy) {
        const session = (0, factories_1.createFittingSession)(name, createdBy);
        this.sessions.set(session.id, session);
        return session;
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
    addSamples(sessionId, dataPoints, addedBy) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        const samples = [];
        dataPoints.forEach(dp => {
            const sample = (0, traceability_1.addSample)(session, dp.x, dp.y, dp.source, addedBy);
            samples.push(sample);
        });
        return samples;
    }
    runFitting(sessionId, method, calculatedBy, excludeAnomalies = true, degree) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        (0, anomalyDetection_1.detectAllAnomalies)(session.samples);
        const fittingResult = (0, fitting_1.calculateFitting)(session.samples, method, calculatedBy, excludeAnomalies, degree);
        session.fittingParams.push(fittingResult.params);
        session.activeFittingId = fittingResult.params.id;
        session.updatedAt = Date.now();
        const equation = (0, fitting_1.formatEquation)(fittingResult.params.coefficients, method, degree);
        const anomalySummary = (0, anomalyDetection_1.getAnomalySummary)(session.samples);
        const isolatedSamples = (0, anomalyDetection_1.isolateAnomalousSamples)(session.samples);
        return {
            session,
            fittingResult,
            equation,
            anomalySummary,
            isolatedSamples,
        };
    }
    confirmSample(sessionId, sampleId, confirmedBy, notes) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        return (0, traceability_1.confirmSample)(session, sampleId, confirmedBy, notes);
    }
    correctSampleValue(sessionId, sampleId, field, newValue, correctedBy, notes) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        return (0, traceability_1.correctSampleValue)(session, sampleId, field, newValue, correctedBy, notes);
    }
    withdrawSample(sessionId, sampleId, withdrawnBy, reason) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        return (0, traceability_1.withdrawSample)(session, sampleId, withdrawnBy, reason);
    }
    updateSample(sessionId, sampleId, field, newValue, changedBy, reason) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        return (0, traceability_1.updateSampleField)(session, sampleId, field, newValue, changedBy, reason);
    }
    getSampleHistory(sessionId, sampleId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        return {
            history: (0, traceability_1.getSampleChangeHistory)(session, sampleId),
            sourceInfo: (0, traceability_1.getSampleSourceInfo)(session.samples.find(s => s.id === sampleId)),
            confirmationDiffs: this.getConfirmationDiffs(sessionId, sampleId),
        };
    }
    getConfirmationDiffs(sessionId, sampleId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        return (0, traceability_1.getConfirmationDiffs)(session, sampleId);
    }
    replayWithWithdrawn(sessionId, withdrawnSampleId, method, calculatedBy, degree) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        const result = (0, traceability_1.recalculateWithWithdrawn)(session, withdrawnSampleId, method, calculatedBy, degree);
        if (!result)
            return null;
        const beforeEquation = (0, fitting_1.formatEquation)(result.before.params.coefficients, method, degree);
        const afterEquation = (0, fitting_1.formatEquation)(result.after.params.coefficients, method, degree);
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
    verifyConsistency(sessionId, fittingId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        return (0, traceability_1.verifyCalibrationConsistency)(session, fittingId);
    }
    getAnomalySummary(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('会话不存在');
        return (0, anomalyDetection_1.getAnomalySummary)(session.samples);
    }
}
exports.FittingService = FittingService;
exports.fittingService = new FittingService();
//# sourceMappingURL=FittingService.js.map