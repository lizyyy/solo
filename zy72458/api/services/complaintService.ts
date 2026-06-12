import { randomUUID } from 'crypto';
import { ResidentComplaint, ImportComplaintDto, ComplaintWithAudit, DashboardStats, ComplaintStatus, DuplicateType } from '../../shared/types.js';
import { dataSource } from '../data/dataSource.js';
import { auditService } from './auditService.js';
import { operationRecordService } from './operationRecordService.js';

function determineInitialStatus(dto: ImportComplaintDto): ComplaintStatus {
  const hasOriginal = !!dto.residentOpinionOriginal && dto.residentOpinionOriginal.trim().length > 0;
  if (!hasOriginal) {
    return 'missing_opinion';
  }
  return 'pending_photo';
}

function determineInitialStep(dto: ImportComplaintDto): 1 | 2 | 3 {
  if (dto.intersectionPhotoUrl) {
    return 2;
  }
  return 1;
}

function generateReportNote(c: Partial<ResidentComplaint>): string {
  const parts: string[] = [];
  if (c.source) parts.push(`来源：${c.source}`);
  if (c.duplicateType === 'this_batch') parts.push('本次导入重复记录');
  if (c.duplicateType === 'historical') parts.push('与历史数据重复');
  if (c.status === 'missing_opinion') {
    parts.push('卡点：居民意见只剩汇总无原文，待社区书记复核');
  } else if (c.status === 'pending_photo') {
    parts.push('待补看路口照片');
  } else if (c.status === 'pending_review') {
    parts.push('待复核');
  } else if (c.status === 'resolved') {
    parts.push(c.reviewConclusion === 'approved' ? '复核通过，已结案' : '复核记录完成');
  }
  if (c.residentOpinion?.hasOriginal) {
    parts.push('居民意见原文完整');
  } else {
    parts.push('居民意见仅含汇总（缺原文）');
  }
  return parts.join(' | ');
}

export const complaintService = {
  async getAll(): Promise<ResidentComplaint[]> {
    const complaints = await dataSource.getComplaints();
    return complaints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getById(id: string): Promise<ResidentComplaint | null> {
    const complaints = await dataSource.getComplaints();
    return complaints.find(c => c.id === id) || null;
  },

  async getWithAudit(id: string): Promise<ComplaintWithAudit | null> {
    const complaint = await this.getById(id);
    if (!complaint) return null;
    const auditLogs = await auditService.getLogsByComplaintId(id);
    return { ...complaint, auditLogs };
  },

  async getByComplaintNo(complaintNo: string): Promise<ResidentComplaint | null> {
    const complaints = await dataSource.getComplaints();
    return complaints.find(c => c.complaintNo === complaintNo && !c.isDuplicate) || null;
  },

  async importComplaints(dtos: ImportComplaintDto[], operator: string): Promise<{
    imported: ResidentComplaint[];
    duplicates: Array<{ dto: ImportComplaintDto; existingId: string }>;
    breakdown: {
      newRecords: ResidentComplaint[];
      thisBatchDuplicates: ResidentComplaint[];
      historicalDuplicates: ResidentComplaint[];
    };
  }> {
    const complaints = await dataSource.getComplaints();
    const imported: ResidentComplaint[] = [];
    const duplicates: Array<{ dto: ImportComplaintDto; existingId: string }> = [];
    const newRecords: ResidentComplaint[] = [];
    const thisBatchDuplicates: ResidentComplaint[] = [];
    const historicalDuplicates: ResidentComplaint[] = [];
    const now = new Date().toISOString();
    const complaintNosInThisBatch = new Set<string>();

    for (const dto of dtos) {
      const existingHistorical = await this.getByComplaintNo(dto.complaintNo);
      const isThisBatchDuplicate = complaintNosInThisBatch.has(dto.complaintNo);
      complaintNosInThisBatch.add(dto.complaintNo);

      const status = determineInitialStatus(dto);
      const step = determineInitialStep(dto);
      const hasOriginal = !!dto.residentOpinionOriginal && dto.residentOpinionOriginal.trim().length > 0;

      if (existingHistorical || isThisBatchDuplicate) {
        const existingId = existingHistorical?.id || '';
        if (existingHistorical) {
          duplicates.push({ dto, existingId });
        }

        const duplicateComplaint: ResidentComplaint = {
          id: randomUUID(),
          complaintNo: dto.complaintNo,
          originalRowNo: dto.originalRowNo,
          importTime: now,
          importBy: operator,
          currentStep: step,
          status,
          isDuplicate: true,
          duplicateOf: existingId,
          duplicateType: isThisBatchDuplicate ? 'this_batch' : 'historical',
          source: dto.source || '居民投诉编号第一次导入',
          intersectionPhoto: {
            hasPhoto: !!dto.intersectionPhotoUrl,
            photoUrl: dto.intersectionPhotoUrl,
          },
          residentOpinion: {
            hasOriginal,
            summary: dto.residentOpinionSummary,
            originalText: dto.residentOpinionOriginal,
          },
          createdAt: now,
          updatedAt: now,
        };
        duplicateComplaint.reportNote = generateReportNote(duplicateComplaint);

        complaints.push(duplicateComplaint);
        imported.push(duplicateComplaint);

        if (isThisBatchDuplicate) {
          thisBatchDuplicates.push(duplicateComplaint);
        } else {
          historicalDuplicates.push(duplicateComplaint);
        }

        await auditService.createLog({
          complaintId: duplicateComplaint.id,
          action: isThisBatchDuplicate ? '批次内重复导入' : '历史重复导入',
          operator,
          operatorRole: 'manager',
          beforeChange: null,
          afterChange: { ...duplicateComplaint },
        });
      } else {
        const newComplaint: ResidentComplaint = {
          id: randomUUID(),
          complaintNo: dto.complaintNo,
          originalRowNo: dto.originalRowNo,
          importTime: now,
          importBy: operator,
          currentStep: step,
          status,
          duplicateType: 'none',
          source: dto.source || '居民投诉编号第一次导入',
          intersectionPhoto: {
            hasPhoto: !!dto.intersectionPhotoUrl,
            photoUrl: dto.intersectionPhotoUrl,
          },
          residentOpinion: {
            hasOriginal,
            summary: dto.residentOpinionSummary,
            originalText: dto.residentOpinionOriginal,
          },
          createdAt: now,
          updatedAt: now,
        };
        newComplaint.reportNote = generateReportNote(newComplaint);

        complaints.push(newComplaint);
        imported.push(newComplaint);
        newRecords.push(newComplaint);

        await auditService.createLog({
          complaintId: newComplaint.id,
          action: '数据导入',
          operator,
          operatorRole: 'manager',
          beforeChange: null,
          afterChange: { ...newComplaint },
        });
      }
    }

    await dataSource.saveComplaints(complaints);

    await operationRecordService.record({
      command: 'import_complaints',
      operator,
      parameters: {
        count: dtos.length,
        importedCount: imported.length,
        duplicateCount: duplicates.length,
        newCount: newRecords.length,
        thisBatchDuplicateCount: thisBatchDuplicates.length,
        historicalDuplicateCount: historicalDuplicates.length,
      },
      result: 'success',
    });

    return {
      imported,
      duplicates,
      breakdown: { newRecords, thisBatchDuplicates, historicalDuplicates },
    };
  },

  async updatePhotoInfo(id: string, params: {
    hasPhoto: boolean;
    photoUrl?: string;
    operator: string;
  }): Promise<ResidentComplaint | null> {
    const complaints = await dataSource.getComplaints();
    const index = complaints.findIndex(c => c.id === id);
    if (index === -1) return null;

    const before = { ...complaints[index] };
    const complaint = complaints[index];

    complaint.intersectionPhoto = {
      hasPhoto: params.hasPhoto,
      photoUrl: params.photoUrl,
      reviewedBy: params.operator,
      reviewTime: new Date().toISOString(),
    };

    if (params.hasPhoto && complaint.currentStep < 2) {
      complaint.currentStep = 2;
    }

    if (complaint.status === 'pending_photo' && params.hasPhoto) {
      complaint.status = complaint.residentOpinion.hasOriginal ? 'pending_review' : 'missing_opinion';
    }

    complaint.updatedAt = new Date().toISOString();
    complaint.reportNote = generateReportNote(complaint);
    complaints[index] = complaint;

    await dataSource.saveComplaints(complaints);

    await auditService.createLog({
      complaintId: id,
      action: '补看路口照片',
      operator: params.operator,
      operatorRole: 'manager',
      beforeChange: { intersectionPhoto: before.intersectionPhoto, currentStep: before.currentStep, status: before.status, reportNote: before.reportNote },
      afterChange: { intersectionPhoto: complaint.intersectionPhoto, currentStep: complaint.currentStep, status: complaint.status, reportNote: complaint.reportNote },
    });

    return complaint;
  },

  async updateResidentOpinion(id: string, params: {
    summary?: string;
    originalText?: string;
    operator: string;
  }): Promise<ResidentComplaint | null> {
    const complaints = await dataSource.getComplaints();
    const index = complaints.findIndex(c => c.id === id);
    if (index === -1) return null;

    const before = { ...complaints[index] };
    const complaint = complaints[index];

    if (params.summary !== undefined) {
      complaint.residentOpinion.summary = params.summary;
    }
    if (params.originalText !== undefined) {
      complaint.residentOpinion.originalText = params.originalText;
      complaint.residentOpinion.hasOriginal = !!params.originalText && params.originalText.trim().length > 0;
    }

    if (complaint.residentOpinion.hasOriginal && complaint.status === 'missing_opinion') {
      complaint.status = complaint.currentStep >= 2 ? 'pending_review' : 'pending_photo';
    } else if (!complaint.residentOpinion.hasOriginal && complaint.status !== 'missing_opinion') {
      complaint.status = 'missing_opinion';
    }

    complaint.updatedAt = new Date().toISOString();
    complaint.reportNote = generateReportNote(complaint);
    complaints[index] = complaint;

    await dataSource.saveComplaints(complaints);

    await auditService.createLog({
      complaintId: id,
      action: '补录居民意见',
      operator: params.operator,
      operatorRole: 'manager',
      beforeChange: { residentOpinion: before.residentOpinion, status: before.status, reportNote: before.reportNote },
      afterChange: { residentOpinion: complaint.residentOpinion, status: complaint.status, reportNote: complaint.reportNote },
    });

    return complaint;
  },

  async reviewBySecretary(id: string, params: {
    operator: string;
    comment: string;
    approve: boolean;
  }): Promise<ResidentComplaint | null> {
    const complaints = await dataSource.getComplaints();
    const index = complaints.findIndex(c => c.id === id);
    if (index === -1) return null;

    const before = { ...complaints[index] };
    const complaint = complaints[index];

    complaint.currentStep = 3;
    complaint.reviewBy = params.operator;
    complaint.reviewTime = new Date().toISOString();
    complaint.reviewComment = params.comment;
    complaint.reviewConclusion = params.approve ? 'approved' : 'pending';

    if (params.approve) {
      complaint.status = 'resolved';
    }

    complaint.updatedAt = new Date().toISOString();
    complaint.reportNote = generateReportNote(complaint);
    complaints[index] = complaint;

    await dataSource.saveComplaints(complaints);

    await auditService.createLog({
      complaintId: id,
      action: '社区书记复核',
      operator: params.operator,
      operatorRole: 'secretary',
      beforeChange: { currentStep: before.currentStep, status: before.status, reviewBy: before.reviewBy, reviewComment: before.reviewComment, reviewConclusion: before.reviewConclusion, reportNote: before.reportNote },
      afterChange: { currentStep: complaint.currentStep, status: complaint.status, reviewBy: complaint.reviewBy, reviewComment: complaint.reviewComment, reviewConclusion: complaint.reviewConclusion, reportNote: complaint.reportNote },
    });

    await operationRecordService.record({
      command: 'review_complaint',
      operator: params.operator,
      parameters: { complaintId: id, approve: params.approve },
      result: 'success',
    });

    return complaint;
  },

  async getStats(): Promise<DashboardStats> {
    const complaints = await dataSource.getComplaints();
    return {
      total: complaints.length,
      pendingPhoto: complaints.filter(c => c.status === 'pending_photo').length,
      pendingReview: complaints.filter(c => c.status === 'pending_review').length,
      missingOpinion: complaints.filter(c => c.status === 'missing_opinion').length,
      normal: complaints.filter(c => c.status === 'normal').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      duplicates: complaints.filter(c => c.isDuplicate).length,
      newRecords: complaints.filter(c => c.duplicateType === 'none').length,
      thisBatchDuplicates: complaints.filter(c => c.duplicateType === 'this_batch').length,
      historicalDuplicates: complaints.filter(c => c.duplicateType === 'historical').length,
    };
  },

  async getMissingOpinionList(): Promise<ResidentComplaint[]> {
    const complaints = await dataSource.getComplaints();
    return complaints.filter(c => c.status === 'missing_opinion');
  },

  async getForExport(): Promise<ResidentComplaint[]> {
    return this.getAll();
  },
};
