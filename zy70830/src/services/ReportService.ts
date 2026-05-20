import moment from 'moment';
import { Parser } from 'json2csv';
import {
  ReconciliationRecord,
  Discrepancy,
  Bed,
  Patient,
  CleaningWorkOrder,
  ReviewDecision
} from '../types';
import { dataStore } from '../models/DataStore';

export class ReportService {
  generateReconciliationReport(recordId: string): {
    summary: ReconciliationRecord;
    discrepancies: Discrepancy[];
    beds: Bed[];
    patients: Patient[];
    workOrders: CleaningWorkOrder[];
    reviewDecisions: ReviewDecision[];
    statistics: {
      totalDiscrepancies: number;
      resolvedDiscrepancies: number;
      pendingDiscrepancies: number;
      resolutionRate: number;
      criticalDiscrepancies: number;
      highDiscrepancies: number;
      mediumDiscrepancies: number;
      lowDiscrepancies: number;
    };
    generatedAt: Date;
  } {
    const record = dataStore.getReconciliationRecord(recordId);
    if (!record) {
      throw new Error(`Reconciliation record ${recordId} not found`);
    }

    const allDiscrepancies = dataStore.getAllDiscrepancies();
    const beds = dataStore.getAllBeds();
    const patients = dataStore.getAllPatients();
    const workOrders = dataStore.getAllWorkOrders();
    const reviewDecisions = dataStore.getAllReviewDecisions();

    const resolvedDiscrepancies = allDiscrepancies.filter(d => d.isResolved).length;
    const pendingDiscrepancies = allDiscrepancies.filter(d => !d.isResolved).length;

    const updatedRecord = dataStore.refreshReconciliationStats(recordId);

    return {
      summary: updatedRecord || record,
      discrepancies: allDiscrepancies,
      beds,
      patients,
      workOrders,
      reviewDecisions,
      statistics: {
        totalDiscrepancies: allDiscrepancies.length,
        resolvedDiscrepancies,
        pendingDiscrepancies,
        resolutionRate: allDiscrepancies.length > 0 
          ? Math.round((resolvedDiscrepancies / allDiscrepancies.length) * 100) 
          : 100,
        criticalDiscrepancies: allDiscrepancies.filter(d => d.severity === 'critical').length,
        highDiscrepancies: allDiscrepancies.filter(d => d.severity === 'high').length,
        mediumDiscrepancies: allDiscrepancies.filter(d => d.severity === 'medium').length,
        lowDiscrepancies: allDiscrepancies.filter(d => d.severity === 'low').length
      },
      generatedAt: new Date()
    };
  }

  exportToCSV(data: any[], fields: string[], filename: string): {
    success: boolean;
    csv: string;
    filename: string;
  } {
    try {
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);

      return {
        success: true,
        csv,
        filename: `${filename}_${moment().format('YYYYMMDD_HHmmss')}.csv`
      };
    } catch (error) {
      throw new Error(`CSV export failed: ${(error as Error).message}`);
    }
  }

  exportDiscrepanciesToCSV(discrepancies?: Discrepancy[]): {
    success: boolean;
    csv: string;
    filename: string;
  } {
    const data = discrepancies || dataStore.getAllDiscrepancies();
    const fields = [
      'id',
      'type',
      'severity',
      'bedNumber',
      'patientName',
      'description',
      'detailedExplanation',
      'isResolved',
      'reviewStatus',
      'reviewedBy',
      'reviewedAt',
      'detectedAt',
      'resolvedAt'
    ];

    const flattenedData = data.map(d => ({
      id: d.id,
      type: d.type,
      severity: d.severity,
      bedNumber: d.bedNumber || '',
      patientName: d.patientName || '',
      description: d.description,
      detailedExplanation: d.detailedExplanation,
      isResolved: d.isResolved ? '是' : '否',
      reviewStatus: d.reviewStatus || '',
      reviewedBy: d.reviewedBy || '',
      reviewedAt: d.reviewedAt ? moment(d.reviewedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      detectedAt: moment(d.detectedAt).format('YYYY-MM-DD HH:mm:ss'),
      resolvedAt: d.resolvedAt ? moment(d.resolvedAt).format('YYYY-MM-DD HH:mm:ss') : ''
    }));

    return this.exportToCSV(flattenedData, fields, 'discrepancies_report');
  }

  exportBedsToCSV(beds?: Bed[]): {
    success: boolean;
    csv: string;
    filename: string;
  } {
    const data = beds || dataStore.getAllBeds();
    const fields = [
      'id',
      'bedNumber',
      'ward',
      'room',
      'status',
      'currentPatientId',
      'isLocked',
      'lastCleanedAt',
      'createdAt',
      'updatedAt'
    ];

    const flattenedData = data.map(b => ({
      id: b.id,
      bedNumber: b.bedNumber,
      ward: b.ward,
      room: b.room,
      status: b.status,
      currentPatientId: b.currentPatientId || '',
      isLocked: b.isLocked ? '是' : '否',
      lastCleanedAt: b.lastCleanedAt ? moment(b.lastCleanedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      createdAt: moment(b.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: moment(b.updatedAt).format('YYYY-MM-DD HH:mm:ss')
    }));

    return this.exportToCSV(flattenedData, fields, 'beds_report');
  }

  exportPatientsToCSV(patients?: Patient[]): {
    success: boolean;
    csv: string;
    filename: string;
  } {
    const data = patients || dataStore.getAllPatients();
    const fields = [
      'id',
      'medicalRecordNumber',
      'name',
      'age',
      'gender',
      'diagnosis',
      'status',
      'currentBedId',
      'admissionDate',
      'dischargeDate',
      'outcome',
      'attendingPhysician',
      'responsibleNurse'
    ];

    const flattenedData = data.map(p => ({
      id: p.id,
      medicalRecordNumber: p.medicalRecordNumber,
      name: p.name,
      age: p.age,
      gender: p.gender,
      diagnosis: p.diagnosis,
      status: p.status,
      currentBedId: p.currentBedId || '',
      admissionDate: moment(p.admissionDate).format('YYYY-MM-DD HH:mm:ss'),
      dischargeDate: p.actualDischargeDate ? moment(p.actualDischargeDate).format('YYYY-MM-DD HH:mm:ss') : '',
      outcome: p.outcome || '',
      attendingPhysician: p.attendingPhysician,
      responsibleNurse: p.responsibleNurse || ''
    }));

    return this.exportToCSV(flattenedData, fields, 'patients_report');
  }

  exportWorkOrdersToCSV(workOrders?: CleaningWorkOrder[]): {
    success: boolean;
    csv: string;
    filename: string;
  } {
    const data = workOrders || dataStore.getAllWorkOrders();
    const fields = [
      'id',
      'bedNumber',
      'ward',
      'patientName',
      'requestedBy',
      'requestedAt',
      'startedAt',
      'completedAt',
      'status',
      'assignedTo',
      'priority',
      'qualityCheckPassed'
    ];

    const flattenedData = data.map(wo => ({
      id: wo.id,
      bedNumber: wo.bedNumber,
      ward: wo.ward,
      patientName: wo.patientName || '',
      requestedBy: wo.requestedBy,
      requestedAt: moment(wo.requestedAt).format('YYYY-MM-DD HH:mm:ss'),
      startedAt: wo.startedAt ? moment(wo.startedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      completedAt: wo.completedAt ? moment(wo.completedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      status: wo.status,
      assignedTo: wo.assignedTo || '',
      priority: wo.priority,
      qualityCheckPassed: wo.qualityCheckPassed !== undefined ? (wo.qualityCheckPassed ? '是' : '否') : ''
    }));

    return this.exportToCSV(flattenedData, fields, 'cleaning_workorders_report');
  }

  generateSummaryStatistics(): {
    bedStatistics: {
      total: number;
      occupied: number;
      vacant: number;
      cleaning: number;
      locked: number;
      occupancyRate: number;
    };
    patientStatistics: {
      total: number;
      admitted: number;
      transferred: number;
      discharged: number;
    };
    cleaningStatistics: {
      total: number;
      pending: number;
      inProgress: number;
      completed: number;
      overdue: number;
      averageCompletionTimeMinutes: number;
    };
    discrepancyStatistics: {
      total: number;
      resolved: number;
      pending: number;
      byType: Record<string, number>;
      bySeverity: Record<string, number>;
      resolutionRate: number;
    };
  } {
    const beds = dataStore.getAllBeds();
    const patients = dataStore.getAllPatients();
    const workOrders = dataStore.getAllWorkOrders();
    const discrepancies = dataStore.getAllDiscrepancies();

    const occupiedBeds = beds.filter(b => b.status === 'occupied').length;

    const completedWorkOrders = workOrders.filter(wo => wo.status === 'completed' && wo.completedAt && wo.startedAt);
    const avgCompletionTime = completedWorkOrders.length > 0
      ? Math.round(completedWorkOrders.reduce((sum, wo) => {
          const diff = moment(wo.completedAt).diff(moment(wo.startedAt), 'minutes');
          return sum + diff;
        }, 0) / completedWorkOrders.length)
      : 0;

    const discrepancyByType: Record<string, number> = {};
    const discrepancyBySeverity: Record<string, number> = {};

    discrepancies.forEach(d => {
      discrepancyByType[d.type] = (discrepancyByType[d.type] || 0) + 1;
      discrepancyBySeverity[d.severity] = (discrepancyBySeverity[d.severity] || 0) + 1;
    });

    return {
      bedStatistics: {
        total: beds.length,
        occupied: occupiedBeds,
        vacant: beds.filter(b => b.status === 'vacant').length,
        cleaning: beds.filter(b => b.status === 'cleaning').length,
        locked: beds.filter(b => b.status === 'locked' || b.isLocked).length,
        occupancyRate: beds.length > 0 ? Math.round((occupiedBeds / beds.length) * 100) : 0
      },
      patientStatistics: {
        total: patients.length,
        admitted: patients.filter(p => p.status === 'admitted').length,
        transferred: patients.filter(p => p.status === 'transferred').length,
        discharged: patients.filter(p => p.status === 'discharged').length
      },
      cleaningStatistics: {
        total: workOrders.length,
        pending: workOrders.filter(wo => wo.status === 'pending').length,
        inProgress: workOrders.filter(wo => wo.status === 'in_progress').length,
        completed: workOrders.filter(wo => wo.status === 'completed').length,
        overdue: workOrders.filter(wo => wo.status === 'overdue').length,
        averageCompletionTimeMinutes: avgCompletionTime
      },
      discrepancyStatistics: {
        total: discrepancies.length,
        resolved: discrepancies.filter(d => d.isResolved).length,
        pending: discrepancies.filter(d => !d.isResolved).length,
        byType: discrepancyByType,
        bySeverity: discrepancyBySeverity,
        resolutionRate: discrepancies.length > 0 
          ? Math.round((discrepancies.filter(d => d.isResolved).length / discrepancies.length) * 100) 
          : 100
      }
    };
  }

  getPatientFullReport(patientId: string): {
    patient: Patient | undefined;
    bedHistory: Array<{
      bedId: string;
      bedNumber: string;
      ward: string;
      assignedAt: Date;
      releasedAt?: Date;
    }>;
    transferHistory: Array<{
      fromWard: string;
      toWard: string;
      transferDate: Date;
      reason?: string;
    }>;
    relatedDiscrepancies: Discrepancy[];
    auditTrail: any[];
  } {
    const patient = dataStore.getPatient(patientId);
    if (!patient) {
      return {
        patient: undefined,
        bedHistory: [],
        transferHistory: [],
        relatedDiscrepancies: [],
        auditTrail: []
      };
    }

    const bedHistory = patient.history
      .filter(h => h.previousBedId || h.newBedId)
      .map(h => ({
        bedId: h.newBedId || h.previousBedId!,
        bedNumber: dataStore.getBed(h.newBedId || h.previousBedId!)?.bedNumber || '未知',
        ward: dataStore.getBed(h.newBedId || h.previousBedId!)?.ward || '未知',
        assignedAt: h.timestamp,
        releasedAt: h.previousBedId ? h.timestamp : undefined
      }));

    const transferHistory = patient.history
      .filter(h => h.previousWard || h.newWard)
      .map(h => ({
        fromWard: h.previousWard || '入院',
        toWard: h.newWard || '出院',
        transferDate: h.timestamp,
        reason: h.notes
      }));

    const relatedDiscrepancies = dataStore.getAllDiscrepancies().filter(d => d.patientId === patientId);
    const auditTrail = dataStore.getAuditLogsByEntity('patient', patientId);

    return {
      patient,
      bedHistory,
      transferHistory,
      relatedDiscrepancies,
      auditTrail
    };
  }

  generateDashboardData(): {
    summary: {
      totalBeds: number;
      totalPatients: number;
      pendingDiscrepancies: number;
      overdueCleaning: number;
      lastReconciliationDate?: Date;
    };
    wardBreakdown: Array<{
      ward: string;
      totalBeds: number;
      occupiedBeds: number;
      vacantBeds: number;
      occupancyRate: number;
    }>;
    recentDiscrepancies: Discrepancy[];
    alerts: Array<{
      type: string;
      message: string;
      severity: string;
      timestamp: Date;
    }>;
  } {
    const beds = dataStore.getAllBeds();
    const patients = dataStore.getAllPatients();
    const discrepancies = dataStore.getAllDiscrepancies();
    const workOrders = dataStore.getAllWorkOrders();
    const reconciliationRecords = dataStore.getAllReconciliationRecords();

    const wardMap = new Map<string, { total: number; occupied: number }>();
    beds.forEach(bed => {
      const wardData = wardMap.get(bed.ward) || { total: 0, occupied: 0 };
      wardData.total++;
      if (bed.status === 'occupied') {
        wardData.occupied++;
      }
      wardMap.set(bed.ward, wardData);
    });

    const wardBreakdown = Array.from(wardMap.entries()).map(([ward, data]) => ({
      ward,
      totalBeds: data.total,
      occupiedBeds: data.occupied,
      vacantBeds: data.total - data.occupied,
      occupancyRate: Math.round((data.occupied / data.total) * 100)
    }));

    const recentDiscrepancies = discrepancies
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
      .slice(0, 10);

    const alerts: Array<{
      type: string;
      message: string;
      severity: string;
      timestamp: Date;
    }> = [];

    const pendingCritical = discrepancies.filter(d => !d.isResolved && d.severity === 'critical').length;
    if (pendingCritical > 0) {
      alerts.push({
        type: 'critical_discrepancies',
        message: `有 ${pendingCritical} 个严重差异待处理`,
        severity: 'critical',
        timestamp: new Date()
      });
    }

    const overdueCleaning = workOrders.filter(wo => wo.status === 'overdue').length;
    if (overdueCleaning > 0) {
      alerts.push({
        type: 'overdue_cleaning',
        message: `有 ${overdueCleaning} 个清洁工单超时`,
        severity: 'high',
        timestamp: new Date()
      });
    }

    const lastRecord = reconciliationRecords.sort((a, b) => 
      new Date(b.reconciliationDate).getTime() - new Date(a.reconciliationDate).getTime()
    )[0];

    return {
      summary: {
        totalBeds: beds.length,
        totalPatients: patients.length,
        pendingDiscrepancies: discrepancies.filter(d => !d.isResolved).length,
        overdueCleaning,
        lastReconciliationDate: lastRecord?.reconciliationDate
      },
      wardBreakdown,
      recentDiscrepancies,
      alerts
    };
  }
}

export const reportService = new ReportService();
