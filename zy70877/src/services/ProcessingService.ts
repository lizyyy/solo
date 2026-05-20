import { Mentor, Application, TransferRecord, ProcessingResult, ProcessedItem, FailedItem } from '../types';
import { dataStore } from '../store/DataStore';
import { validationService } from './ValidationService';

export class ProcessingService {
  processMentors(mentors: Mentor[], batchId: string): ProcessingResult<Mentor> {
    const result: ProcessingResult<Mentor> = {
      normal: [],
      pending: [],
      failed: []
    };

    for (const mentor of mentors) {
      const existing = dataStore.getMentor(mentor.id);
      
      if (existing) {
        result.failed.push({
          original: mentor,
          error: '导师ID已存在',
          suggestion: '如需更新导师信息，请先删除原有记录或使用更新接口'
        });
        continue;
      }

      if (mentor.quota < 0 || mentor.usedQuota < 0) {
        result.failed.push({
          original: mentor,
          error: '名额或已用名额不能为负数',
          suggestion: '请核对CSV文件中的数字格式'
        });
        continue;
      }

      if (mentor.usedQuota > mentor.quota) {
        result.pending.push({
          data: mentor,
          message: `已用名额(${mentor.usedQuota})超过总名额(${mentor.quota})，需人工确认`
        });
        continue;
      }

      dataStore.addMentor(mentor);
      result.normal.push({
        data: mentor,
        message: `导师信息导入成功，剩余名额：${mentor.quota - mentor.usedQuota}`
      });
    }

    return result;
  }

  processApplications(applications: Application[], batchId: string): ProcessingResult<Application> {
    const result: ProcessingResult<Application> = {
      normal: [],
      pending: [],
      failed: []
    };

    for (const app of applications) {
      app.batchId = batchId;
      app.createdAt = new Date();

      const mentor = dataStore.getMentor(app.mentorId);
      const validationError = validationService.validateApplication(app, mentor);

      if (validationError) {
        if (validationError.rule === 'cross_major' && app.isTransfer) {
          app.status = 'pending';
          dataStore.addApplication(app);
          result.pending.push({
            data: app,
            message: validationError.message
          });
        } else if (validationError.rule === 'quota' && validationError.message.includes('即将用尽')) {
          app.status = 'normal';
          dataStore.addApplication(app);
          if (mentor) {
            dataStore.updateMentorQuota(app.mentorId, mentor.usedQuota + 1);
          }
          result.normal.push({
            data: app,
            message: `录取成功，${validationError.message}`
          });
        } else {
          app.status = 'failed';
          result.failed.push({
            original: app,
            error: validationError.message,
            suggestion: validationError.suggestion
          });
        }
        continue;
      }

      app.status = 'normal';
      dataStore.addApplication(app);
      
      if (mentor) {
        dataStore.updateMentorQuota(app.mentorId, mentor.usedQuota + 1);
        const warning = validationService.checkQuotaWarning({
          ...mentor,
          usedQuota: mentor.usedQuota + 1
        });
        result.normal.push({
          data: app,
          message: warning || `志愿确认成功，导师${mentor.name}(${mentor.direction})`
        });
      } else {
        result.normal.push({
          data: app,
          message: '志愿导入成功'
        });
      }
    }

    return result;
  }

  processTransfers(transfers: TransferRecord[], batchId: string): ProcessingResult<TransferRecord> {
    const result: ProcessingResult<TransferRecord> = {
      normal: [],
      pending: [],
      failed: []
    };

    for (const transfer of transfers) {
      transfer.batchId = batchId;
      transfer.createdAt = new Date();

      const mentor = dataStore.getAllMentors().find(m => m.major === transfer.toMajor);
      const validationError = validationService.validateTransfer(transfer, mentor);

      if (validationError) {
        transfer.status = 'failed';
        result.failed.push({
          original: transfer,
          error: validationError.message,
          suggestion: validationError.suggestion
        });
        continue;
      }

      const studentApps = dataStore.getApplicationsByStudent(transfer.studentId);
      const hasOtherAdmission = studentApps.some(a => a.status === 'normal' || a.status === 'confirmed');

      if (hasOtherAdmission) {
        transfer.status = 'pending';
        dataStore.addTransfer(transfer);
        result.pending.push({
          data: transfer,
          message: '该学生已有其他志愿录取，调剂需人工确认优先级'
        });
        continue;
      }

      transfer.status = 'normal';
      dataStore.addTransfer(transfer);
      result.normal.push({
        data: transfer,
        message: `调剂记录导入成功：${transfer.fromMajor} -> ${transfer.toMajor}`
      });
    }

    return result;
  }

  processBatch(batchId: string, mentors?: Mentor[], applications?: Application[], transfers?: TransferRecord[]) {
    if (dataStore.isBatchProcessed(batchId)) {
      throw new Error(`批次 ${batchId} 已处理过，不能重复导入`);
    }

    const mentorResult = mentors ? this.processMentors(mentors, batchId) : null;
    const applicationResult = applications ? this.processApplications(applications, batchId) : null;
    const transferResult = transfers ? this.processTransfers(transfers, batchId) : null;

    dataStore.markBatchProcessed(batchId);

    return {
      batchId,
      processedAt: new Date(),
      summary: {
        mentors: mentorResult ? {
          normal: mentorResult.normal.length,
          pending: mentorResult.pending.length,
          failed: mentorResult.failed.length
        } : null,
        applications: applicationResult ? {
          normal: applicationResult.normal.length,
          pending: applicationResult.pending.length,
          failed: applicationResult.failed.length
        } : null,
        transfers: transferResult ? {
          normal: transferResult.normal.length,
          pending: transferResult.pending.length,
          failed: transferResult.failed.length
        } : null
      },
      details: {
        mentors: mentorResult,
        applications: applicationResult,
        transfers: transferResult
      }
    };
  }

  confirmApplication(applicationId: string): Application {
    const app = dataStore.getApplication(applicationId);
    if (!app) {
      throw new Error('申请记录不存在');
    }
    app.status = 'confirmed';
    return app;
  }

  getStatistics() {
    return {
      mentors: dataStore.getAllMentors().length,
      applications: {
        total: dataStore.getAllApplications().length,
        normal: dataStore.getAllApplications().filter(a => a.status === 'normal').length,
        confirmed: dataStore.getAllApplications().filter(a => a.status === 'confirmed').length,
        pending: dataStore.getAllApplications().filter(a => a.status === 'pending').length,
        failed: dataStore.getAllApplications().filter(a => a.status === 'failed').length
      },
      transfers: {
        total: dataStore.getAllTransfers().length,
        pending: dataStore.getAllTransfers().filter(t => t.status === 'pending').length
      },
      batches: dataStore.getAllApplications().filter((v, i, a) => 
        a.findIndex(t => t.batchId === v.batchId) === i
      ).length
    };
  }
}

export const processingService = new ProcessingService();
