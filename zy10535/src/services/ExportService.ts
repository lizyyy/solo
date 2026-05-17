import * as XLSX from 'xlsx';
import { Parser } from 'json2csv';
import { VisitSchedule } from '../entities/VisitSchedule';
import { DelayRecord } from '../entities/DelayRecord';
import { VisitReport } from '../entities/VisitReport';

export type ExportFormat = 'xlsx' | 'csv';

export interface ExportFilters {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  personInChargeId?: string;
  customerId?: string;
}

export class ExportService {
  private formatScheduleForExport(schedules: VisitSchedule[]): any[] {
    return schedules.map(schedule => ({
      '排期编号': schedule.scheduleNumber,
      '客户名称': schedule.customer?.name || '',
      '客户账号': schedule.customer?.accountNumber || '',
      '负责人': schedule.personInCharge?.name || '',
      '回访类型': schedule.visitType,
      '回访渠道': schedule.visitChannel,
      '状态': schedule.status,
      '预约开始时间': schedule.scheduledStartTime.toISOString(),
      '预约结束时间': schedule.scheduledEndTime.toISOString(),
      '时长(分钟)': schedule.durationMinutes,
      '主题': schedule.subject || '',
      '描述': schedule.description || '',
      '实际开始时间': schedule.actualStartTime?.toISOString() || '',
      '实际结束时间': schedule.actualEndTime?.toISOString() || '',
      '负责人确认': schedule.isConfirmedByPerson ? '是' : '否',
      '确认时间': schedule.confirmedAt?.toISOString() || '',
      '创建时间': schedule.createdAt.toISOString(),
      '创建人': schedule.createdBy || ''
    }));
  }

  private formatDelaysForExport(delays: DelayRecord[]): any[] {
    return delays.map(delay => ({
      '排期编号': delay.visitSchedule?.scheduleNumber || '',
      '延期原因': delay.reason,
      '原因描述': delay.reasonDescription,
      '原预约时间': delay.originalScheduledTime.toISOString(),
      '新预约时间': delay.newScheduledTime?.toISOString() || '',
      '延期时长(分钟)': delay.delayMinutes || '',
      '申请人': delay.requestedBy || '',
      '审批人': delay.approvedBy || '',
      '是否审批': delay.isApproved ? '是' : '否',
      '审批时间': delay.approvedAt?.toISOString() || '',
      '创建时间': delay.createdAt.toISOString()
    }));
  }

  private formatReportsForExport(reports: VisitReport[]): any[] {
    return reports.map(report => ({
      '报告编号': report.reportNumber,
      '排期编号': report.visitSchedule?.scheduleNumber || '',
      '状态': report.status,
      '回访总结': report.visitSummary || '',
      '客户反馈': report.customerFeedback || '',
      '发现问题': report.issuesIdentified || '',
      '行动项': report.actionItems || '',
      '需要跟进': report.followUpRequired || '',
      '下次跟进日期': report.nextFollowUpDate?.toISOString() || '',
      '满意度评分': report.satisfactionScore || '',
      '提交人': report.submittedBy || '',
      '提交时间': report.submittedAt?.toISOString() || '',
      '审核人': report.reviewedBy || '',
      '审核时间': report.reviewedAt?.toISOString() || '',
      '审核意见': report.reviewComments || '',
      '创建时间': report.createdAt.toISOString()
    }));
  }

  exportToExcel(
    schedules: VisitSchedule[],
    delays?: DelayRecord[],
    reports?: VisitReport[]
  ): Buffer {
    const workbook = XLSX.utils.book_new();

    const scheduleData = this.formatScheduleForExport(schedules);
    const scheduleSheet = XLSX.utils.json_to_sheet(scheduleData);
    XLSX.utils.book_append_sheet(workbook, scheduleSheet, '回访排期');

    if (delays && delays.length > 0) {
      const delayData = this.formatDelaysForExport(delays);
      const delaySheet = XLSX.utils.json_to_sheet(delayData);
      XLSX.utils.book_append_sheet(workbook, delaySheet, '延期记录');
    }

    if (reports && reports.length > 0) {
      const reportData = this.formatReportsForExport(reports);
      const reportSheet = XLSX.utils.json_to_sheet(reportData);
      XLSX.utils.book_append_sheet(workbook, reportSheet, '回访报告');
    }

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  exportToCSV(schedules: VisitSchedule[]): string {
    const data = this.formatScheduleForExport(schedules);
    const parser = new Parser();
    return parser.parse(data);
  }

  exportDelaysToCSV(delays: DelayRecord[]): string {
    const data = this.formatDelaysForExport(delays);
    const parser = new Parser();
    return parser.parse(data);
  }

  exportReportsToCSV(reports: VisitReport[]): string {
    const data = this.formatReportsForExport(reports);
    const parser = new Parser();
    return parser.parse(data);
  }
}
