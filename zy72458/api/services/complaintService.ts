import { randomUUID } from 'crypto';
import { ResidentComplaint, ImportComplaintDto, ComplaintWithAudit, DashboardStats, ComplaintStatus } from '../../shared/types.js';
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
  }> {
    const complaints = await dataSource.getComplaints();
    const imported: ResidentComplaint[] = [];
    const duplicates: Array<{ dto: ImportComplaintDto; existingId: string }> = [];
    const now = new Date().toISOString();

    for (const dto of dtos) {
      const existing = await this.getByComplaintNo(dto.complaintNo);
      
      if (existing) {
        duplicates.push({ dto, existingId: existing.id });
        
        const duplicateComplaint: ResidentComplaint = {
          id: randomUUID(),
          complaintNo: dto.complaintNo,
          originalRowNo: dto.originalRowNo,
          importTime: now,
          importBy: operator,
          currentStep: 1,
          status: 'pending_photo',
          isDuplicate: true,
          duplicateOf: existing.id,
          intersectionPhoto: {
            hasPhoto: !!dto.intersectionPhotoUrl,
            photoUrl: dto.intersectionPhotoUrl,
          },
          residentOpinion: {
            hasOriginal: !!dto.residentOpinionOriginal,
            summary: dto.residentOpinionSummary,
            originalText: dto.residentOpinionOriginal,
          },
          createdAt: now,
          updatedAt: now,
        };
        
        complaints.push(duplicateComplaint);
        imported.push(duplicateComplaint);

        await auditService.createLog({
          complaintId: duplicateComplaint.id,
          action: '重复导入标记',
          operator,
          operatorRole: 'manager',
          beforeChange: null,
          afterChange: { ...duplicateComplaint },
        });
      } else {
        const status = determineInitialStatus(dto);
        const step = determineInitialStep(dto);
        
        const newComplaint: ResidentComplaint = {
          id: randomUUID(),
          complaintNo: dto.complaintNo,
          originalRowNo: dto.originalRowNo,
          importTime: now,
          importBy: operator,
          currentStep: step,
          status,
          intersectionPhoto: {
            hasPhoto: !!dto.intersectionPhotoUrl,
            photoUrl: dto.intersectionPhotoUrl,
          },
          residentOpinion: {
            hasOriginal: !!dto.residentOpinionOriginal,
            summary: dto.residentOpinionSummary,
            originalText: dto.residentOpinionOriginal,
          },
          createdAt: now,
          updatedAt: now,
        };
        
        complaints.push(newComplaint);
        imported.push(newComplaint);

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
      parameters: { count: dtos.length, importedCount: imported.length, duplicateCount: duplicates.length },
      result: 'success',
    });

    return { imported, duplicates };
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
    complaints[index] = complaint;

    await dataSource.saveComplaints(complaints);

    await auditService.createLog({
      complaintId: id,
      action: '补看路口照片',
      operator: params.operator,
      operatorRole: 'manager',
      beforeChange: { intersectionPhoto: before.intersectionPhoto, currentStep: before.currentStep, status: before.status },
      afterChange: { intersectionPhoto: complaint.intersectionPhoto, currentStep: complaint.currentStep, status: complaint.status },
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
    complaints[index] = complaint;

    await dataSource.saveComplaints(complaints);

    await auditService.createLog({
      complaintId: id,
      action: '补录居民意见',
      operator: params.operator,
      operatorRole: 'manager',
      beforeChange: { residentOpinion: before.residentOpinion, status: before.status },
      afterChange: { residentOpinion: complaint.residentOpinion, status: complaint.status },
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

    if (params.approve) {
      complaint.status = 'resolved';
    }

    complaint.updatedAt = new Date().toISOString();
    complaints[index] = complaint;

    await dataSource.saveComplaints(complaints);

    await auditService.createLog({
      complaintId: id,
      action: '社区书记复核',
      operator: params.operator,
      operatorRole: 'secretary',
      beforeChange: { currentStep: before.currentStep, status: before.status, reviewBy: before.reviewBy, reviewComment: before.reviewComment },
      afterChange: { currentStep: complaint.currentStep, status: complaint.status, reviewBy: complaint.reviewBy, reviewComment: complaint.reviewComment },
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
