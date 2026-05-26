import { v4 as uuidv4 } from 'uuid';
import { AttendanceRecord, AssignmentRecord, CourseRule, ProcessedRecord, ValidationResult } from '../types';

export class ValidationEngine {
  private rule: CourseRule;

  constructor(rule: CourseRule) {
    this.rule = rule;
  }

  public processAttendance(records: AttendanceRecord[]): ProcessedRecord<AttendanceRecord>[] {
    return records.map(record => this.validateAttendance(record));
  }

  public processAssignments(records: AssignmentRecord[]): ProcessedRecord<AssignmentRecord>[] {
    return records.map(record => this.validateAssignment(record));
  }

  private validateAttendance(record: AttendanceRecord): ProcessedRecord<AttendanceRecord> {
    const checkInTime = new Date(record.checkInTime);
    const scheduledTime = new Date(record.scheduledStartTime);
    const diffMinutes = Math.round((checkInTime.getTime() - scheduledTime.getTime()) / (1000 * 60));

    if (record.checkInStatus === 'makeup') {
      return this.processMakeupAttendance(record, diffMinutes);
    }

    if (record.checkInStatus === 'absent') {
      return {
        id: uuidv4(),
        type: 'attendance',
        original: record,
        status: 'failed',
        category: 'attendance_absent',
        reason: `员工 ${record.employeeName}(${record.employeeId}) 本次课程缺勤`,
        suggestion: '请核实缺勤原因，如需补签请在规则允许的时间内提交补签申请并附有效证明',
        requiresManualReview: true,
        reviewAction: 'request_more_info'
      };
    }

    if (diffMinutes > this.rule.lateThresholdMinutes) {
      return {
        id: uuidv4(),
        type: 'attendance',
        original: record,
        status: 'pending',
        category: 'attendance_late',
        reason: `迟到 ${diffMinutes} 分钟，超过规定阈值 ${this.rule.lateThresholdMinutes} 分钟`,
        suggestion: `扣除 ${this.rule.latePenaltyPoints} 分。如累计迟到超过 ${this.rule.maxLateAllowed} 次将影响证书发放。如有特殊情况请提交说明`,
        pointsDeducted: this.rule.latePenaltyPoints,
        requiresManualReview: true,
        reviewAction: 'approve'
      };
    }

    return {
      id: uuidv4(),
      type: 'attendance',
      original: record,
      status: 'normal',
      category: 'attendance_normal',
      reason: '签到正常，符合课程要求',
      suggestion: '无需处理',
      requiresManualReview: false
    };
  }

  private processMakeupAttendance(record: AttendanceRecord, diffMinutes: number): ProcessedRecord<AttendanceRecord> {
    if (!this.rule.allowMakeup) {
      return {
        id: uuidv4(),
        type: 'attendance',
        original: record,
        status: 'failed',
        category: 'makeup_not_allowed',
        reason: '本课程不允许补签',
        suggestion: '该补签申请不予通过，请按缺勤处理。如有特殊情况需联系课程管理员审批',
        requiresManualReview: true,
        reviewAction: 'reject'
      };
    }

    if (!record.makeupApproved) {
      return {
        id: uuidv4(),
        type: 'attendance',
        original: record,
        status: 'pending',
        category: 'makeup_pending_approval',
        reason: '补签申请尚未审批',
        suggestion: `请在 ${this.rule.makeupDeadlineDays} 天内完成补签审批，需提供有效补签理由和证明材料`,
        requiresManualReview: true,
        reviewAction: 'request_more_info'
      };
    }

    if (record.makeupApproved && record.makeupReason) {
      return {
        id: uuidv4(),
        type: 'attendance',
        original: record,
        status: 'normal',
        category: 'makeup_approved',
        reason: `补签已批准，理由：${record.makeupReason}`,
        suggestion: '补签有效，已记录为正常出勤',
        requiresManualReview: false
      };
    }

    return {
      id: uuidv4(),
      type: 'attendance',
      original: record,
      status: 'failed',
      category: 'makeup_incomplete',
      reason: '补签记录缺少审批状态或补签理由',
      suggestion: '请补充完整的补签审批信息和理由说明',
      requiresManualReview: true,
      reviewAction: 'request_more_info'
    };
  }

  private validateAssignment(record: AssignmentRecord): ProcessedRecord<AssignmentRecord> {
    if (record.status === 'failed') {
      return {
        id: uuidv4(),
        type: 'assignment',
        original: record,
        status: 'failed',
        category: 'assignment_failed',
        reason: `作业得分 ${record.score} 分，低于及格线 ${record.passScore} 分`,
        suggestion: '本次作业不合格，请通知学员重新提交或参加补考。如多次作业不合格将影响证书发放',
        requiresManualReview: true,
        reviewAction: 'request_more_info'
      };
    }

    if (record.status === 'submitted_late') {
      return {
        id: uuidv4(),
        type: 'assignment',
        original: record,
        status: 'pending',
        category: 'assignment_late',
        reason: `作业迟交。提交时间：${record.submittedAt}，截止时间：${record.deadline}`,
        suggestion: '迟交作业需评估是否扣分，建议根据课程迟交政策处理。如无特殊政策可按正常通过处理',
        requiresManualReview: true,
        reviewAction: 'approve'
      };
    }

    if (record.status === 'pending') {
      return {
        id: uuidv4(),
        type: 'assignment',
        original: record,
        status: 'pending',
        category: 'assignment_pending',
        reason: '作业尚未批改',
        suggestion: '请尽快完成作业批改，以确保证书发放流程顺利进行',
        requiresManualReview: true,
        reviewAction: 'request_more_info'
      };
    }

    return {
      id: uuidv4(),
      type: 'assignment',
      original: record,
      status: 'normal',
      category: 'assignment_passed',
      reason: `作业得分 ${record.score} 分，达到及格线要求`,
      suggestion: '无需处理',
      requiresManualReview: false
    };
  }

  public checkCertificateEligibility(
    employeeId: string,
    attendanceRecords: ProcessedRecord<AttendanceRecord>[],
    assignmentRecords: ProcessedRecord<AssignmentRecord>[]
  ): { eligible: boolean; reason: string; suggestion: string } {
    const employeeAttendance = attendanceRecords.filter(r => r.original.employeeId === employeeId);
    const employeeAssignments = assignmentRecords.filter(r => r.original.employeeId === employeeId);

    const lateCount = employeeAttendance.filter(r => r.category === 'attendance_late').length;
    const absentCount = employeeAttendance.filter(r => r.category === 'attendance_absent').length;
    const totalSessions = employeeAttendance.length;
    const attendanceRate = totalSessions > 0 ? (totalSessions - absentCount) / totalSessions : 0;

    const failedAssignments = employeeAssignments.filter(r => r.category === 'assignment_failed').length;

    if (this.rule.certificateRevokeConditions.tooManyLates && lateCount > this.rule.maxLateAllowed) {
      return {
        eligible: false,
        reason: `迟到次数过多：共迟到 ${lateCount} 次，超过最大允许次数 ${this.rule.maxLateAllowed} 次`,
        suggestion: '不符合证书发放条件。如员工有特殊情况，可在申诉期内提交申诉材料'
      };
    }

    if (this.rule.certificateRevokeConditions.lowAttendance && attendanceRate < this.rule.requiredAttendanceRate) {
      return {
        eligible: false,
        reason: `出勤率不足：实际出勤率 ${(attendanceRate * 100).toFixed(1)}%，要求 ${(this.rule.requiredAttendanceRate * 100)}%`,
        suggestion: '不符合证书发放条件。如有缺勤可核实是否为已批准的补签或特殊情况'
      };
    }

    if (this.rule.certificateRevokeConditions.assignmentFailed && failedAssignments > 0) {
      return {
        eligible: false,
        reason: `存在不合格作业：${failedAssignments} 份作业未通过`,
        suggestion: '不符合证书发放条件。请通知学员完成不合格作业的补考或重新提交'
      };
    }

    return {
      eligible: true,
      reason: '所有考核项均通过，符合证书发放条件',
      suggestion: '可以发放证书'
    };
  }

  public combineResults(
    batchId: string,
    courseBatch: string,
    attendanceResults: ProcessedRecord<AttendanceRecord>[],
    assignmentResults: ProcessedRecord<AssignmentRecord>[]
  ): ValidationResult {
    const allResults = [...attendanceResults, ...assignmentResults];
    
    return {
      batchId,
      courseBatch,
      processedAt: new Date().toISOString(),
      summary: {
        total: allResults.length,
        normal: allResults.filter(r => r.status === 'normal').length,
        pending: allResults.filter(r => r.status === 'pending').length,
        failed: allResults.filter(r => r.status === 'failed').length
      },
      normalItems: allResults.filter(r => r.status === 'normal'),
      pendingItems: allResults.filter(r => r.status === 'pending'),
      failedItems: allResults.filter(r => r.status === 'failed')
    };
  }
}
