import { createObjectCsvStringifier } from 'csv-writer';
import { store } from '../models/store';
import { RegistrationReport, RegistrationStatus, AuditTrail } from '../models/types';

export class ReportService {
  generateReport(trainingId: string): RegistrationReport {
    const training = store.getTraining(trainingId);
    if (!training) {
      throw new Error('培训不存在');
    }

    const registrations = store.getRegistrationsByTraining(trainingId);
    
    const countByStatus = (status: RegistrationStatus) => 
      registrations.filter(r => r.status === status).length;

    return {
      trainingId,
      trainingCode: training.trainingCode,
      trainingName: training.name,
      totalRegistrations: registrations.length,
      qualifiedCount: countByStatus(RegistrationStatus.QUALIFIED),
      waitlistCount: countByStatus(RegistrationStatus.WAITLIST),
      rejectedCount: countByStatus(RegistrationStatus.REJECTED),
      cancelledCount: countByStatus(RegistrationStatus.CANCELLED),
      registrations,
      generatedAt: new Date()
    };
  }

  async exportReportToCsv(trainingId: string): Promise<string> {
    const report = this.generateReport(trainingId);

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: '报名ID' },
        { id: 'applicantId', title: '报名人ID' },
        { id: 'applicantName', title: '报名人姓名' },
        { id: 'applicantEmail', title: '报名人邮箱' },
        { id: 'status', title: '状态' },
        { id: 'waitlistOrder', title: '候补序号' },
        { id: 'reviewComment', title: '审核意见' },
        { id: 'reviewedBy', title: '审核人' },
        { id: 'reviewedAt', title: '审核时间' },
        { id: 'createdAt', title: '报名时间' }
      ]
    });

    const records = report.registrations.map(r => ({
      id: r.id,
      applicantId: r.applicantId,
      applicantName: r.applicantName,
      applicantEmail: r.applicantEmail,
      status: this.translateStatus(r.status),
      waitlistOrder: r.waitlistOrder || '',
      reviewComment: r.reviewComment || '',
      reviewedBy: r.reviewedBy || '',
      reviewedAt: r.reviewedAt?.toISOString() || '',
      createdAt: r.createdAt.toISOString()
    }));

    const headerRow = '培训报告\n' +
      `培训编号,${report.trainingCode}\n` +
      `培训名称,${report.trainingName}\n` +
      `总报名数,${report.totalRegistrations}\n` +
      `通过数,${report.qualifiedCount}\n` +
      `候补数,${report.waitlistCount}\n` +
      `拒绝数,${report.rejectedCount}\n` +
      `取消数,${report.cancelledCount}\n` +
      `生成时间,${report.generatedAt.toISOString()}\n\n`;

    return headerRow + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  async exportAuditTrailToCsv(trainingId: string): Promise<string> {
    const training = store.getTraining(trainingId);
    if (!training) {
      throw new Error('培训不存在');
    }

    const auditTrails = store.getAuditTrailsByTraining(trainingId);

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'registrationId', title: '报名ID' },
        { id: 'action', title: '操作' },
        { id: 'previousStatus', title: '之前状态' },
        { id: 'newStatus', title: '新状态' },
        { id: 'operator', title: '操作人' },
        { id: 'comment', title: '备注' },
        { id: 'timestamp', title: '时间' },
        { id: 'processingBasis', title: '处理依据' }
      ]
    });

    const records = auditTrails.map((a: AuditTrail) => ({
      id: a.id,
      registrationId: a.registrationId,
      action: this.translateAction(a.action),
      previousStatus: a.previousStatus ? this.translateStatus(a.previousStatus) : '',
      newStatus: a.newStatus ? this.translateStatus(a.newStatus) : '',
      operator: a.operator,
      comment: a.comment || '',
      timestamp: a.timestamp.toISOString(),
      processingBasis: a.processingBasis || ''
    }));

    return '审核留痕记录\n' +
      `培训编号,${training.trainingCode}\n` +
      `培训名称,${training.name}\n` +
      `生成时间,${new Date().toISOString()}\n\n` +
      csvStringifier.getHeaderString() + 
      csvStringifier.stringifyRecords(records);
  }

  private translateStatus(status: RegistrationStatus): string {
    const statusMap: Record<RegistrationStatus, string> = {
      [RegistrationStatus.PENDING_REVIEW]: '待审核',
      [RegistrationStatus.QUALIFIED]: '已通过',
      [RegistrationStatus.WAITLIST]: '候补',
      [RegistrationStatus.REJECTED]: '已拒绝',
      [RegistrationStatus.CANCELLED]: '已取消',
      [RegistrationStatus.PROMOTED]: '已晋级'
    };
    return statusMap[status] || status;
  }

  private translateAction(action: string): string {
    const actionMap: Record<string, string> = {
      'CREATE_REGISTRATION': '创建报名',
      'APPROVE': '审核通过',
      'REJECT': '审核拒绝',
      'CANCEL': '取消报名',
      'PROMOTE_FROM_WAITLIST': '候补晋级',
      'MANUAL_CORRECTION': '人工修正'
    };
    return actionMap[action] || action;
  }
}

export const reportService = new ReportService();
