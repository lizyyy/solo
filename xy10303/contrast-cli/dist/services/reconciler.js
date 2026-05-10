"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reconciler = void 0;
class Reconciler {
    constructor(store) {
        this.store = store;
    }
    reconcile(date) {
        const appointments = this.store.getAppointmentsByDate(date);
        const usageRecords = this.store.getUsageByDate(date);
        const batches = this.store.getBatches();
        const manualCorrections = this.store.getManualCorrections(date);
        const issues = [];
        const appointmentReconciliations = [];
        const usageByAppointment = new Map();
        usageRecords.forEach(usage => {
            if (!usageByAppointment.has(usage.appointmentId)) {
                usageByAppointment.set(usage.appointmentId, []);
            }
            usageByAppointment.get(usage.appointmentId).push(usage);
        });
        appointments.forEach(appointment => {
            const usages = usageByAppointment.get(appointment.appointmentId) || [];
            const reconciliation = this.reconcileAppointment(appointment, usages);
            appointmentReconciliations.push(reconciliation);
            issues.push(...reconciliation.issues);
        });
        const refundedAppointments = appointmentReconciliations.filter(ar => ar.status === 'refunded');
        refundedAppointments.forEach(ar => {
            if (ar.usage && ar.usage.isRefund) {
                const issue = this.checkRefundConsistency(ar.usage);
                if (issue)
                    issues.push(issue);
            }
        });
        const batchSummaries = this.generateBatchSummaries(date, batches, usageRecords);
        const reconciled = appointmentReconciliations.filter(ar => ar.status === 'completed' || ar.status === 'refunded').length;
        const pending = appointmentReconciliations.filter(ar => ar.status === 'pending' || ar.status === 'missing_usage').length;
        return {
            date,
            totalAppointments: appointments.length,
            reconciled,
            pending,
            issues,
            batchSummary: batchSummaries,
            manualCorrections
        };
    }
    reconcileAppointment(appointment, usages) {
        const issues = [];
        const totalDose = usages
            .filter(u => !u.isRefund)
            .reduce((sum, u) => sum + u.actualDose, 0);
        const refundDose = usages
            .filter(u => u.isRefund)
            .reduce((sum, u) => sum + u.actualDose, 0);
        if (usages.length === 0) {
            return {
                appointment,
                status: 'missing_usage',
                plannedDose: appointment.plannedDose,
                actualDose: 0,
                doseDifference: appointment.plannedDose,
                issues: [{
                        type: 'missing_usage',
                        appointmentId: appointment.appointmentId,
                        message: `患者 ${appointment.patientName} (${appointment.appointmentId}) 缺少用药记录`,
                        severity: 'warning'
                    }]
            };
        }
        if (usages.length > 1 && usages.some(u => !u.isRefund)) {
            issues.push({
                type: 'duplicate_usage',
                appointmentId: appointment.appointmentId,
                message: `患者 ${appointment.patientName} (${appointment.appointmentId}) 存在多条用药记录`,
                severity: 'error'
            });
        }
        const normalUsage = usages.find(u => !u.isRefund);
        const refundUsage = usages.find(u => u.isRefund);
        if (normalUsage && refundUsage) {
            issues.push({
                type: 'duplicate_usage',
                appointmentId: appointment.appointmentId,
                message: `患者 ${appointment.patientName} (${appointment.appointmentId}) 同时存在用药和退费记录`,
                severity: 'error'
            });
        }
        if (refundUsage) {
            return {
                appointment,
                status: 'refunded',
                usage: refundUsage,
                plannedDose: appointment.plannedDose,
                actualDose: 0,
                doseDifference: appointment.plannedDose,
                issues
            };
        }
        if (normalUsage) {
            const doseDiff = totalDose - appointment.plannedDose;
            if (Math.abs(doseDiff) > 5 && Math.abs(doseDiff) > appointment.plannedDose * 0.1) {
                issues.push({
                    type: 'excess_usage',
                    appointmentId: appointment.appointmentId,
                    message: `患者 ${appointment.patientName} (${appointment.appointmentId}) 实际用量 (${totalDose}ml) 与计划用量 (${appointment.plannedDose}ml) 差异超过 10%`,
                    severity: 'warning'
                });
            }
            return {
                appointment,
                status: 'completed',
                usage: normalUsage,
                plannedDose: appointment.plannedDose,
                actualDose: totalDose,
                doseDifference: doseDiff,
                issues
            };
        }
        return {
            appointment,
            status: 'pending',
            plannedDose: appointment.plannedDose,
            actualDose: totalDose,
            doseDifference: appointment.plannedDose - totalDose,
            issues
        };
    }
    checkRefundConsistency(usage) {
        const appointment = this.store.getAppointment(usage.appointmentId);
        if (!appointment) {
            return {
                type: 'refund_mismatch',
                appointmentId: usage.appointmentId,
                message: `退费记录对应的预约号 ${usage.appointmentId} 不存在`,
                severity: 'error'
            };
        }
        if (Math.abs(usage.actualDose - appointment.plannedDose) > 5) {
            return {
                type: 'refund_mismatch',
                appointmentId: usage.appointmentId,
                message: `患者 ${appointment.patientName} 退费剂量 (${usage.actualDose}ml) 与计划剂量 (${appointment.plannedDose}ml) 不一致`,
                severity: 'warning'
            };
        }
        return null;
    }
    generateBatchSummaries(date, batches, usageRecords) {
        const summaries = [];
        const batchUsageMap = new Map();
        usageRecords.forEach(usage => {
            if (!batchUsageMap.has(usage.batchNumber)) {
                batchUsageMap.set(usage.batchNumber, { used: 0, refunded: 0 });
            }
            const stats = batchUsageMap.get(usage.batchNumber);
            if (usage.isRefund) {
                stats.refunded += usage.actualDose;
            }
            else {
                stats.used += usage.actualDose;
            }
        });
        const affectedBatchNumbers = new Set(batchUsageMap.keys());
        batches.forEach(batch => {
            if (!affectedBatchNumbers.has(batch.batchNumber)) {
                return;
            }
            const stats = batchUsageMap.get(batch.batchNumber) || { used: 0, refunded: 0 };
            const remaining = batch.totalVolume - stats.used - stats.refunded;
            let issue;
            if (remaining < 0) {
                issue = `批次用量超过总量 ${Math.abs(remaining)}ml`;
            }
            else if (remaining > 0 && remaining < 10) {
                issue = `剩余量较少: ${remaining}ml`;
            }
            summaries.push({
                batchNumber: batch.batchNumber,
                contrastAgent: batch.contrastAgent,
                totalVolume: batch.totalVolume,
                usedVolume: stats.used,
                refundedVolume: stats.refunded,
                remainingVolume: remaining,
                issue
            });
        });
        return summaries;
    }
    getPendingItems(date) {
        const reconciliation = this.reconcile(date);
        const appointments = this.store.getAppointmentsByDate(date);
        const usageRecords = this.store.getUsageByDate(date);
        const usageByAppointment = new Map();
        usageRecords.forEach(usage => {
            if (!usageByAppointment.has(usage.appointmentId)) {
                usageByAppointment.set(usage.appointmentId, []);
            }
            usageByAppointment.get(usage.appointmentId).push(usage);
        });
        const pending = [];
        appointments.forEach(appointment => {
            const usages = usageByAppointment.get(appointment.appointmentId) || [];
            const rec = this.reconcileAppointment(appointment, usages);
            if (rec.status === 'missing_usage' || rec.status === 'pending') {
                pending.push(rec);
            }
        });
        return pending;
    }
    generateDailyReport(date) {
        const reconciliation = this.reconcile(date);
        const appointments = this.store.getAppointmentsByDate(date);
        const usageRecords = this.store.getUsageByDate(date);
        const corrections = this.store.getManualCorrections(date);
        const usageByAppointment = new Map();
        usageRecords.forEach(usage => {
            if (!usageByAppointment.has(usage.appointmentId)) {
                usageByAppointment.set(usage.appointmentId, []);
            }
            usageByAppointment.get(usage.appointmentId).push(usage);
        });
        let completed = 0;
        let pending = 0;
        let refunded = 0;
        appointments.forEach(appointment => {
            const usages = usageByAppointment.get(appointment.appointmentId) || [];
            const rec = this.reconcileAppointment(appointment, usages);
            if (rec.status === 'completed')
                completed++;
            else if (rec.status === 'refunded')
                refunded++;
            else
                pending++;
        });
        const hasErrors = reconciliation.issues.some(i => i.severity === 'error');
        const hasWarnings = reconciliation.issues.some(i => i.severity === 'warning');
        let status = 'complete';
        if (hasErrors)
            status = 'has_errors';
        else if (pending > 0 || hasWarnings)
            status = 'pending';
        return {
            date,
            generatedAt: new Date().toISOString(),
            appointmentStats: {
                total: appointments.length,
                completed,
                pending,
                refunded
            },
            batchStats: reconciliation.batchSummary,
            issues: reconciliation.issues,
            manualCorrections: corrections,
            reconciliationStatus: status
        };
    }
}
exports.Reconciler = Reconciler;
