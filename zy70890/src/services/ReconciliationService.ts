import dayjs from 'dayjs';
import { DataStore } from '../store/DataStore';
import {
  ReconciliationRecord,
  DifferenceDetail,
  DifferenceType,
  AttendanceStatus,
  ReviewStatus,
  LeaveStatus,
  ObjectLevel,
  TracePoint
} from '../types';

export class ReconciliationService {
  private store: DataStore;

  constructor() {
    this.store = DataStore.getInstance();
  }

  performReconciliation(date: string): { reconciliationId: string; records: ReconciliationRecord[] } {
    const reconciliationId = this.store.generateReconciliationId();
    const persons = this.store.getAllPersons();
    const records: ReconciliationRecord[] = [];

    for (const person of persons) {
      const record = this.reconcilePerson(person, date, reconciliationId);
      records.push(record);
      this.store.addReconciliationRecord(record);
    }

    return { reconciliationId, records };
  }

  private reconcilePerson(
    person: { id: string; name: string; level: ObjectLevel },
    date: string,
    reconciliationId: string
  ): ReconciliationRecord {
    const attendance = this.store.getAttendancesByDateAndPerson(date, person.id)[0];
    const leaves = this.store.getLeavesByDateRange(date, date, person.id);
    const locationTrace = this.store.getLocationTraceByDateAndPerson(date, person.id);

    const differences: DifferenceDetail[] = [];
    let finalStatus: AttendanceStatus = AttendanceStatus.NORMAL;

    if (attendance) {
      finalStatus = attendance.status;
    }

    this.checkTimeoutNoSign(attendance, date, differences);
    this.checkLeaveOverlap(attendance, leaves, date, differences);
    this.checkTraceGap(locationTrace, differences);
    this.checkLocationAnomaly(locationTrace, differences);

    if (differences.some(d => d.type === DifferenceType.LEAVE_OVERLAP)) {
      finalStatus = AttendanceStatus.LEAVE;
    } else if (differences.length > 0 && finalStatus === AttendanceStatus.NORMAL) {
      finalStatus = AttendanceStatus.EXCEPTION;
    }

    return {
      id: this.store.generateId(),
      reconciliationId,
      personId: person.id,
      personName: person.name,
      personLevel: person.level,
      date,
      attendance,
      leave: leaves[0],
      locationTrace,
      differences,
      finalStatus,
      reviewStatus: ReviewStatus.PENDING,
      isManualCorrected: false,
      createdAt: this.store.now(),
      updatedAt: this.store.now()
    };
  }

  private checkTimeoutNoSign(
    attendance: any,
    date: string,
    differences: DifferenceDetail[]
  ): void {
    if (!attendance || (!attendance.signInTime && !attendance.signOutTime)) {
      differences.push({
        type: DifferenceType.TIMEOUT_NO_SIGN,
        description: `${date} 全天未签到签退`,
        source: '签到系统',
        severity: 'high'
      });
      return;
    }

    const expectedSignIn = dayjs(`${date} ${attendance.expectedSignInTime || '09:00'}`);
    const expectedSignOut = dayjs(`${date} ${attendance.expectedSignOutTime || '18:00'}`);

    if (attendance.signInTime) {
      const signInTime = dayjs(`${date} ${attendance.signInTime}`);
      if (signInTime.isAfter(expectedSignIn.add(30, 'minute'))) {
        differences.push({
          type: DifferenceType.TIMEOUT_NO_SIGN,
          description: `签到超时，应签时间 ${attendance.expectedSignInTime}，实际签到 ${attendance.signInTime}`,
          source: '签到系统',
          severity: 'medium',
          evidence: `签到记录ID: ${attendance.id}`
        });
      }
    } else {
      differences.push({
        type: DifferenceType.TIMEOUT_NO_SIGN,
        description: '未签到',
        source: '签到系统',
        severity: 'high'
      });
    }

    if (attendance.signOutTime) {
      const signOutTime = dayjs(`${date} ${attendance.signOutTime}`);
      if (signOutTime.isBefore(expectedSignOut.subtract(30, 'minute'))) {
        differences.push({
          type: DifferenceType.TIMEOUT_NO_SIGN,
          description: `签退提前，应签时间 ${attendance.expectedSignOutTime}，实际签退 ${attendance.signOutTime}`,
          source: '签到系统',
          severity: 'medium',
          evidence: `签到记录ID: ${attendance.id}`
        });
      }
    } else {
      differences.push({
        type: DifferenceType.TIMEOUT_NO_SIGN,
        description: '未签退',
        source: '签到系统',
        severity: 'high'
      });
    }
  }

  private checkLeaveOverlap(
    attendance: any,
    leaves: any[],
    date: string,
    differences: DifferenceDetail[]
  ): void {
    const approvedLeaves = leaves.filter(l => l.status === LeaveStatus.APPROVED);
    
    if (approvedLeaves.length > 0) {
      const leave = approvedLeaves[0];
      differences.push({
        type: DifferenceType.LEAVE_OVERLAP,
        description: `请假记录覆盖：${leave.leaveType} 假，${leave.startDate} 至 ${leave.endDate}，原因：${leave.reason}`,
        source: '请假系统',
        severity: 'low',
        evidence: `请假记录ID: ${leave.id}，审批人: ${leave.approver || '未填写'}`
      });
    }
  }

  private checkTraceGap(
    locationTrace: any,
    differences: DifferenceDetail[]
  ): void {
    if (!locationTrace) {
      differences.push({
        type: DifferenceType.TRACE_GAP,
        description: '当日无定位轨迹数据',
        source: '定位系统',
        severity: 'high'
      });
      return;
    }

    if (!locationTrace.isComplete) {
      differences.push({
        type: DifferenceType.TRACE_GAP,
        description: '定位轨迹不完整',
        source: '定位系统',
        severity: 'medium'
      });
    }

    const tracePoints = locationTrace.tracePoints || [];
    if (tracePoints.length < 2) {
      differences.push({
        type: DifferenceType.TRACE_GAP,
        description: `定位轨迹点过少，仅 ${tracePoints.length} 个点`,
        source: '定位系统',
        severity: 'medium'
      });
      return;
    }

    for (let i = 1; i < tracePoints.length; i++) {
      const prev = dayjs(tracePoints[i - 1].timestamp);
      const curr = dayjs(tracePoints[i].timestamp);
      const gapMinutes = curr.diff(prev, 'minute');
      
      if (gapMinutes > 120) {
        differences.push({
          type: DifferenceType.TRACE_GAP,
          description: `轨迹间隔异常，${prev.format('HH:mm')} 至 ${curr.format('HH:mm')} 间隔 ${gapMinutes} 分钟，超过2小时`,
          source: '定位系统',
          severity: gapMinutes > 240 ? 'high' : 'medium'
        });
      }
    }
  }

  private checkLocationAnomaly(
    locationTrace: any,
    differences: DifferenceDetail[]
  ): void {
    if (!locationTrace) {
      return;
    }

    const tracePoints = locationTrace.tracePoints || [];
    const anomalyPoints = tracePoints.filter((p: TracePoint) => p.isAnomaly);

    if (anomalyPoints.length > 0) {
      for (const point of anomalyPoints) {
        differences.push({
          type: DifferenceType.LOCATION_ANOMALY,
          description: `定位异常：${dayjs(point.timestamp).format('HH:mm')} 在 ${point.location}，原因：${point.anomalyReason || '未说明'}`,
          source: '定位系统',
          severity: 'medium',
          evidence: `经纬度: ${point.latitude}, ${point.longitude}`
        });
      }
    }
  }

  recalculateReconciliation(reconciliationId: string): ReconciliationRecord[] {
    const records = this.store.getReconciliationRecordsByReconciliationId(reconciliationId);
    const updatedRecords: ReconciliationRecord[] = [];

    for (const record of records) {
      if (!record.isManualCorrected) {
        const newDifferences: DifferenceDetail[] = [];
        let newFinalStatus: AttendanceStatus = AttendanceStatus.NORMAL;

        if (record.attendance) {
          newFinalStatus = record.attendance.status;
        }

        this.checkTimeoutNoSign(record.attendance, record.date, newDifferences);
        this.checkLeaveOverlap(record.attendance, record.leave ? [record.leave] : [], record.date, newDifferences);
        this.checkTraceGap(record.locationTrace, newDifferences);
        this.checkLocationAnomaly(record.locationTrace, newDifferences);

        if (newDifferences.some(d => d.type === DifferenceType.LEAVE_OVERLAP)) {
          newFinalStatus = AttendanceStatus.LEAVE;
        } else if (newDifferences.length > 0 && newFinalStatus === AttendanceStatus.NORMAL) {
          newFinalStatus = AttendanceStatus.EXCEPTION;
        }

        record.differences = newDifferences;
        record.finalStatus = newFinalStatus;
        this.store.updateReconciliationRecord(record);
      }
      updatedRecords.push(record);
    }

    return updatedRecords;
  }
}
