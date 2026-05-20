"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconciliationEngine = void 0;
const constants_1 = require("../constants");
const date_1 = require("../utils/date");
class ReconciliationEngine {
    constructor(reconciliationDate) {
        this.students = [];
        this.healthChecks = [];
        this.medications = [];
        this.results = [];
        this.reconciliationDate = reconciliationDate || (0, date_1.formatDate)(new Date());
    }
    loadData(students, healthChecks, medications) {
        this.students = students;
        this.healthChecks = healthChecks;
        this.medications = medications;
    }
    performReconciliation() {
        this.results = [];
        for (const student of this.students) {
            const healthCheck = this.healthChecks.find((h) => h.studentId === student.studentId);
            const medication = this.medications.find((m) => m.studentId === student.studentId);
            const discrepancies = [];
            if (healthCheck) {
                discrepancies.push(...this.checkHealthCheckDiscrepancies(healthCheck));
            }
            if (medication) {
                discrepancies.push(...this.checkMedicationDiscrepancies(medication));
            }
            if (healthCheck && !medication) {
                discrepancies.push(this.createDiscrepancy('MEDICATION_NOT_RECORDED', `学生${student.name}有晨检记录但无对应用药授权`, healthCheck.id, 'healthCheck'));
            }
            const status = this.determineStatus(discrepancies);
            this.results.push({
                id: (0, date_1.generateId)(),
                reconciliationDate: this.reconciliationDate,
                studentId: student.studentId,
                studentName: student.name,
                className: student.className,
                healthCheck,
                medication,
                student,
                discrepancies,
                status,
                version: 1,
            });
        }
        for (const healthCheck of this.healthChecks) {
            const student = this.students.find((s) => s.studentId === healthCheck.studentId);
            if (!student) {
                const discrepancies = [
                    this.createDiscrepancy('STUDENT_NOT_IN_CLASS', `晨检名单中的学生${healthCheck.studentName}不在班级名单内`, healthCheck.id, 'healthCheck'),
                ];
                this.results.push({
                    id: (0, date_1.generateId)(),
                    reconciliationDate: this.reconciliationDate,
                    studentId: healthCheck.studentId,
                    studentName: healthCheck.studentName,
                    className: '未知班级',
                    healthCheck,
                    student: {
                        id: (0, date_1.generateId)(),
                        studentId: healthCheck.studentId,
                        name: healthCheck.studentName,
                        className: '未知班级',
                        grade: '未知',
                    },
                    discrepancies,
                    status: 'NEEDS_MORE_INFO',
                    version: 1,
                });
            }
        }
        return this.results;
    }
    checkHealthCheckDiscrepancies(healthCheck) {
        const discrepancies = [];
        if ((0, date_1.isFever)(healthCheck.temperature)) {
            discrepancies.push(this.createDiscrepancy('FEVER_DETECTED', `体温${healthCheck.temperature}°C，超过警戒线，${healthCheck.isIsolated ? '已按规定隔离' : '需立即隔离处理'}`, healthCheck.id, 'healthCheck'));
        }
        if (healthCheck.hasSymptoms && !healthCheck.isIsolated && !healthCheck.notes) {
            discrepancies.push(this.createDiscrepancy('SYMPTOMS_UNCHECKED', `报告有症状：${healthCheck.symptoms?.join('、')}，但未说明处理措施`, healthCheck.id, 'healthCheck'));
        }
        return discrepancies;
    }
    checkMedicationDiscrepancies(medication) {
        const discrepancies = [];
        if ((0, date_1.isMedicationExpired)(medication.expiryDate, this.reconciliationDate)) {
            discrepancies.push(this.createDiscrepancy('OVERDUE_MEDICATION', `药品"${medication.medicationName}"已于${medication.expiryDate}过期，禁止使用`, medication.id, 'medication'));
        }
        else if ((0, date_1.isMedicationExpiringSoon)(medication.expiryDate, this.reconciliationDate)) {
            discrepancies.push(this.createDiscrepancy('OVERDUE_MEDICATION', `药品"${medication.medicationName}"将于${medication.expiryDate}到期，剩余有效期不足3天`, medication.id, 'medication'));
        }
        if (!medication.parentConfirmed) {
            discrepancies.push(this.createDiscrepancy('PARENT_NOT_CONFIRMED', `药品"${medication.medicationName}"未获得家长签字确认，不能给药`, medication.id, 'medication'));
        }
        return discrepancies;
    }
    createDiscrepancy(type, description, relatedRecordId, relatedRecordType) {
        return {
            id: (0, date_1.generateId)(),
            type,
            severity: constants_1.SEVERITY_MAPPING[type],
            description,
            explanation: constants_1.DISCREPANCY_EXPLANATIONS[type],
            relatedRecordId,
            relatedRecordType,
        };
    }
    determineStatus(discrepancies) {
        if (discrepancies.length === 0) {
            return 'APPROVED';
        }
        const highSeverity = discrepancies.some((d) => d.severity === 'HIGH');
        const mediumSeverity = discrepancies.some((d) => d.severity === 'MEDIUM');
        if (highSeverity) {
            return 'REJECTED';
        }
        else if (mediumSeverity) {
            return 'NEEDS_MORE_INFO';
        }
        return 'PENDING';
    }
    getResults() {
        return this.results;
    }
    getResultsByStatus(status) {
        return this.results.filter((r) => r.status === status);
    }
    getResultById(id) {
        return this.results.find((r) => r.id === id);
    }
    updateResult(updatedResult) {
        const index = this.results.findIndex((r) => r.id === updatedResult.id);
        if (index !== -1) {
            this.results[index] = {
                ...updatedResult,
                version: updatedResult.version + 1,
            };
        }
    }
}
exports.ReconciliationEngine = ReconciliationEngine;
