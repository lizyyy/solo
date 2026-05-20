import {
  Student,
  HealthCheckRecord,
  MedicationAuthorization,
  ReconciliationResult,
  Discrepancy,
  DiscrepancyType,
  RecordStatus,
} from '../types';
import { DISCREPANCY_EXPLANATIONS, SEVERITY_MAPPING } from '../constants';
import { generateId, isFever, isMedicationExpired, isMedicationExpiringSoon, formatDate } from '../utils/date';

export class ReconciliationEngine {
  private students: Student[] = [];
  private healthChecks: HealthCheckRecord[] = [];
  private medications: MedicationAuthorization[] = [];
  private results: ReconciliationResult[] = [];
  private reconciliationDate: string;

  constructor(reconciliationDate?: string) {
    this.reconciliationDate = reconciliationDate || formatDate(new Date());
  }

  loadData(
    students: Student[],
    healthChecks: HealthCheckRecord[],
    medications: MedicationAuthorization[]
  ): void {
    this.students = students;
    this.healthChecks = healthChecks;
    this.medications = medications;
  }

  performReconciliation(): ReconciliationResult[] {
    this.results = [];

    for (const student of this.students) {
      const healthCheck = this.healthChecks.find((h) => h.studentId === student.studentId);
      const medication = this.medications.find((m) => m.studentId === student.studentId);

      const discrepancies: Discrepancy[] = [];

      if (healthCheck) {
        discrepancies.push(...this.checkHealthCheckDiscrepancies(healthCheck));
      }

      if (medication) {
        discrepancies.push(...this.checkMedicationDiscrepancies(medication));
      }

      if (healthCheck && !medication) {
        discrepancies.push(
          this.createDiscrepancy(
            'MEDICATION_NOT_RECORDED',
            `学生${student.name}有晨检记录但无对应用药授权`,
            healthCheck.id,
            'healthCheck'
          )
        );
      }

      const status = this.determineStatus(discrepancies);

      this.results.push({
        id: generateId(),
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
          this.createDiscrepancy(
            'STUDENT_NOT_IN_CLASS',
            `晨检名单中的学生${healthCheck.studentName}不在班级名单内`,
            healthCheck.id,
            'healthCheck'
          ),
        ];
        this.results.push({
          id: generateId(),
          reconciliationDate: this.reconciliationDate,
          studentId: healthCheck.studentId,
          studentName: healthCheck.studentName,
          className: '未知班级',
          healthCheck,
          student: {
            id: generateId(),
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

  private checkHealthCheckDiscrepancies(healthCheck: HealthCheckRecord): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    if (isFever(healthCheck.temperature)) {
      discrepancies.push(
        this.createDiscrepancy(
          'FEVER_DETECTED',
          `体温${healthCheck.temperature}°C，超过警戒线，${healthCheck.isIsolated ? '已按规定隔离' : '需立即隔离处理'}`,
          healthCheck.id,
          'healthCheck'
        )
      );
    }

    if (healthCheck.hasSymptoms && !healthCheck.isIsolated && !healthCheck.notes) {
      discrepancies.push(
        this.createDiscrepancy(
          'SYMPTOMS_UNCHECKED',
          `报告有症状：${healthCheck.symptoms?.join('、')}，但未说明处理措施`,
          healthCheck.id,
          'healthCheck'
        )
      );
    }

    return discrepancies;
  }

  private checkMedicationDiscrepancies(medication: MedicationAuthorization): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    if (isMedicationExpired(medication.expiryDate, this.reconciliationDate)) {
      discrepancies.push(
        this.createDiscrepancy(
          'OVERDUE_MEDICATION',
          `药品"${medication.medicationName}"已于${medication.expiryDate}过期，禁止使用`,
          medication.id,
          'medication'
        )
      );
    } else if (isMedicationExpiringSoon(medication.expiryDate, this.reconciliationDate)) {
      discrepancies.push(
        this.createDiscrepancy(
          'OVERDUE_MEDICATION',
          `药品"${medication.medicationName}"将于${medication.expiryDate}到期，剩余有效期不足3天`,
          medication.id,
          'medication'
        )
      );
    }

    if (!medication.parentConfirmed) {
      discrepancies.push(
        this.createDiscrepancy(
          'PARENT_NOT_CONFIRMED',
          `药品"${medication.medicationName}"未获得家长签字确认，不能给药`,
          medication.id,
          'medication'
        )
      );
    }

    return discrepancies;
  }

  private createDiscrepancy(
    type: DiscrepancyType,
    description: string,
    relatedRecordId?: string,
    relatedRecordType?: 'healthCheck' | 'medication' | 'student'
  ): Discrepancy {
    return {
      id: generateId(),
      type,
      severity: SEVERITY_MAPPING[type],
      description,
      explanation: DISCREPANCY_EXPLANATIONS[type],
      relatedRecordId,
      relatedRecordType,
    };
  }

  private determineStatus(discrepancies: Discrepancy[]): RecordStatus {
    if (discrepancies.length === 0) {
      return 'APPROVED';
    }

    const highSeverity = discrepancies.some((d) => d.severity === 'HIGH');
    const mediumSeverity = discrepancies.some((d) => d.severity === 'MEDIUM');

    if (highSeverity) {
      return 'REJECTED';
    } else if (mediumSeverity) {
      return 'NEEDS_MORE_INFO';
    }

    return 'PENDING';
  }

  getResults(): ReconciliationResult[] {
    return this.results;
  }

  getResultsByStatus(status: RecordStatus): ReconciliationResult[] {
    return this.results.filter((r) => r.status === status);
  }

  getResultById(id: string): ReconciliationResult | undefined {
    return this.results.find((r) => r.id === id);
  }

  updateResult(updatedResult: ReconciliationResult): void {
    const index = this.results.findIndex((r) => r.id === updatedResult.id);
    if (index !== -1) {
      this.results[index] = {
        ...updatedResult,
        version: updatedResult.version + 1,
      };
    }
  }
}