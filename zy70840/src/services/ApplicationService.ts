import { Op } from 'sequelize';
import Application, { ApplicationStatus } from '../models/Application';
import ProcessingLog, { LogType } from '../models/ProcessingLog';
import CertificateService from './CertificateService';
import ScheduleService from './ScheduleService';
import dayjs from 'dayjs';

export interface ProcessOptions {
  autoCheckCertificate?: boolean;
  autoCheckSchedule?: boolean;
  venueName?: string;
}

class ApplicationService {
  async getApplicationById(id: number) {
    return await Application.findByPk(id, {
      include: [
        { association: 'certificates' },
        { association: 'schedules' },
        { association: 'logs', order: [['operatedAt', 'DESC']] },
        { association: 'depositFlows', order: [['operatedAt', 'DESC']] },
      ],
    });
  }

  async listApplications(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      batchId?: number;
      status?: ApplicationStatus;
      merchantName?: string;
      stallLocation?: string;
      startDate?: Date;
      endDate?: Date;
      certificateVersion?: string;
    }
  ) {
    const where: any = {};
    
    if (filters) {
      if (filters.batchId) {
        where.batchId = filters.batchId;
      }
      if (filters.status) {
        where.status = filters.status;
      }
      if (filters.merchantName) {
        where.merchantName = { [Op.like]: `%${filters.merchantName}%` };
      }
      if (filters.stallLocation) {
        where.stallLocation = { [Op.like]: `%${filters.stallLocation}%` };
      }
      if (filters.startDate && filters.endDate) {
        where.startDate = { [Op.lte]: filters.endDate };
        where.endDate = { [Op.gte]: filters.startDate };
      }
      if (filters.certificateVersion) {
        where.certificateVersion = { [Op.like]: `%${filters.certificateVersion}%` };
      }
    }

    const { count, rows } = await Application.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: [{ association: 'batch', attributes: ['batchNo', 'name'] }],
    });

    return { total: count, list: rows, page, pageSize };
  }

  async addLog(
    applicationId: number,
    logType: LogType,
    reason: string,
    readableReason: string,
    operator: string,
    oldStatus?: string,
    newStatus?: string,
    metadata?: any
  ) {
    return await ProcessingLog.create({
      applicationId,
      logType,
      reason,
      readableReason,
      operator,
      operatedAt: new Date(),
      oldStatus,
      newStatus,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  }

  async processApplication(
    applicationId: number,
    newStatus: ApplicationStatus,
    operator: string,
    reason: string,
    options?: ProcessOptions
  ) {
    const application = await this.getApplicationById(applicationId);
    if (!application) {
      throw new Error('申请记录不存在');
    }

    const oldStatus = application.status;
    const issues: string[] = [];

    if (options?.autoCheckCertificate) {
      const certCheck = await CertificateService.checkCertificates(applicationId, operator);
      if (!certCheck.isValid) {
        issues.push(...certCheck.issues.map(i => i.readableIssue));
        for (const issue of certCheck.issues) {
          await this.addLog(
            applicationId,
            LogType.CERTIFICATE_ISSUE,
            issue.issue,
            issue.readableIssue,
            operator,
            oldStatus,
            newStatus
          );
        }
      }
    }

    if (options?.autoCheckSchedule && options.venueName) {
      const scheduleCheck = await ScheduleService.checkConflict(
        options.venueName,
        application.stallLocation,
        application.startDate,
        application.endDate,
        applicationId
      );
      if (scheduleCheck.hasConflict) {
        issues.push(...scheduleCheck.conflicts.map(c => c.readableConflict));
        for (const conflict of scheduleCheck.conflicts) {
          await this.addLog(
            applicationId,
            LogType.SCHEDULE_CONFLICT,
            conflict.conflictType,
            conflict.readableConflict,
            operator,
            oldStatus,
            newStatus
          );
        }
      }
    }

    if (issues.length > 0 && newStatus === ApplicationStatus.APPROVED) {
      throw new Error(`存在问题无法通过审核：${issues.join('; ')}`);
    }

    const readableReason = this.getStatusChangeReadableReason(oldStatus, newStatus, reason, operator);
    
    await application.update({
      status: newStatus,
      processedAt: new Date(),
      processedBy: operator,
    });

    await this.addLog(
      applicationId,
      LogType.STATUS_CHANGE,
      reason,
      readableReason,
      operator,
      oldStatus,
      newStatus
    );

    if (newStatus === ApplicationStatus.APPROVED && options?.venueName) {
      try {
        await ScheduleService.occupySchedule(
          applicationId,
          options.venueName,
          application.stallLocation,
          application.startDate,
          application.endDate
        );
      } catch (err: any) {
        await application.update({ status: oldStatus });
        throw err;
      }
    }

    if (oldStatus === ApplicationStatus.APPROVED && 
        (newStatus === ApplicationStatus.REJECTED || newStatus === ApplicationStatus.RETURNED)) {
      await ScheduleService.releaseSchedule(applicationId);
    }

    return {
      application: await this.getApplicationById(applicationId),
      issues,
    };
  }

  private getStatusChangeReadableReason(
    oldStatus: string,
    newStatus: string,
    reason: string,
    operator: string
  ): string {
    const statusMap: Record<string, string> = {
      [ApplicationStatus.PENDING]: '待处理',
      [ApplicationStatus.PROCESSING]: '处理中',
      [ApplicationStatus.APPROVED]: '已通过',
      [ApplicationStatus.REJECTED]: '已拒绝',
      [ApplicationStatus.RETURNED]: '已退回',
    };

    const oldStatusName = statusMap[oldStatus] || oldStatus;
    const newStatusName = statusMap[newStatus] || newStatus;

    return `操作员【${operator}】将状态从【${oldStatusName}】变更为【${newStatusName}】，原因：${reason || '未说明'}`;
  }

  async returnForModify(
    applicationId: number,
    operator: string,
    reason: string
  ) {
    return this.processApplication(
      applicationId,
      ApplicationStatus.RETURNED,
      operator,
      reason
    );
  }

  async approveApplication(
    applicationId: number,
    operator: string,
    reason: string,
    venueName?: string
  ) {
    return this.processApplication(
      applicationId,
      ApplicationStatus.APPROVED,
      operator,
      reason,
      {
        autoCheckCertificate: true,
        autoCheckSchedule: !!venueName,
        venueName,
      }
    );
  }

  async rejectApplication(
    applicationId: number,
    operator: string,
    reason: string
  ) {
    return this.processApplication(
      applicationId,
      ApplicationStatus.REJECTED,
      operator,
      reason
    );
  }

  async getLogsByApplication(applicationId: number) {
    return await ProcessingLog.findAll({
      where: { applicationId },
      order: [['operatedAt', 'DESC']],
    });
  }
}

export default new ApplicationService();
