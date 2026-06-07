import { create } from 'zustand';
import { 
  RedlineRemark, RedlineVersion, Inspection, Complaint, 
  ScoreCalculation, Report, ImportPreview 
} from '../types';
import { 
  mockRedlineRemarks, mockRedlineVersions, mockInspections, 
  mockComplaints, mockScoreCalculations, mockReports 
} from '../data/mockData';

interface AppState {
  redlineRemarks: RedlineRemark[];
  redlineVersions: RedlineVersion[];
  inspections: Inspection[];
  complaints: Complaint[];
  scoreCalculations: ScoreCalculation[];
  reports: Report[];
  currentUser: string;

  addRedlineRemark: (remark: Omit<RedlineRemark, 'id' | 'importedAt' | 'currentVersion'>) => void;
  updateRedlineRemark: (id: string, updates: Partial<RedlineRemark>, changeReason: string) => void;
  batchImportRedlineRemarks: (items: Partial<RedlineRemark>[]) => ImportPreview;
  getVersionsForRemark: (remarkId: string) => RedlineVersion[];
  
  addComplaint: (complaint: Omit<Complaint, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateComplaintStatus: (id: string, status: Complaint['status'], note?: string) => void;
  updateComplaintScore: (id: string, newScore: number, calculation: Omit<ScoreCalculation, 'id' | 'complaintId' | 'calculatedAt'>) => void;
  
  generateReport: (complaintId: string) => Report;
  getComplaintWithRelations: (id: string) => {
    complaint: Complaint | undefined;
    redlineRemark: RedlineRemark | undefined;
    inspection: Inspection | undefined;
    calculation: ScoreCalculation | undefined;
    report: Report | undefined;
  };
}

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useAppStore = create<AppState>((set, get) => ({
  redlineRemarks: mockRedlineRemarks,
  redlineVersions: mockRedlineVersions,
  inspections: mockInspections,
  complaints: mockComplaints,
  scoreCalculations: mockScoreCalculations,
  reports: mockReports,
  currentUser: '周姐',

  addRedlineRemark: (remark) => {
    const newRemark: RedlineRemark = {
      ...remark,
      id: generateId('rl'),
      importedAt: new Date().toISOString(),
      currentVersion: 1,
    };
    const newVersion: RedlineVersion = {
      id: generateId('v'),
      remarkId: newRemark.id,
      version: 1,
      data: newRemark,
      changedBy: get().currentUser,
      changedAt: new Date().toISOString(),
      changeReason: '初始导入',
    };
    set((state) => ({
      redlineRemarks: [...state.redlineRemarks, newRemark],
      redlineVersions: [...state.redlineVersions, newVersion],
    }));
  },

  updateRedlineRemark: (id, updates, changeReason) => {
    set((state) => {
      const remark = state.redlineRemarks.find((r) => r.id === id);
      if (!remark) return state;
      
      const newVersion = remark.currentVersion + 1;
      const newVersionRecord: RedlineVersion = {
        id: generateId('v'),
        remarkId: id,
        version: newVersion,
        data: updates,
        changedBy: state.currentUser,
        changedAt: new Date().toISOString(),
        changeReason,
      };
      
      return {
        redlineRemarks: state.redlineRemarks.map((r) =>
          r.id === id ? { ...r, ...updates, currentVersion: newVersion } : r
        ),
        redlineVersions: [...state.redlineVersions, newVersionRecord],
      };
    });
  },

  batchImportRedlineRemarks: (items) => {
    const state = get();
    const existingCodes = new Map(state.redlineRemarks.map((r) => [r.code, r]));
    let newItems = 0;
    let updatedItems = 0;
    const duplicates: ImportPreview['duplicates'] = [];
    const newRemarks: RedlineRemark[] = [];
    const newVersions: RedlineVersion[] = [];
    const updatedRemarks: RedlineRemark[] = [];

    items.forEach((item) => {
      if (!item.code) return;
      
      const existing = existingCodes.get(item.code);
      if (existing) {
        duplicates.push({ code: item.code, existing, incoming: item });
        const hasChanges = Object.entries(item).some(
          ([key, value]) => existing[key as keyof RedlineRemark] !== value
        );
        if (hasChanges) {
          updatedItems++;
          const newVersion = existing.currentVersion + 1;
          newVersions.push({
            id: generateId('v'),
            remarkId: existing.id,
            version: newVersion,
            data: item,
            changedBy: state.currentUser,
            changedAt: new Date().toISOString(),
            changeReason: '批量导入更新',
          });
          updatedRemarks.push({ ...existing, ...item, currentVersion: newVersion });
        }
      } else {
        newItems++;
        const newRemark: RedlineRemark = {
          id: generateId('rl'),
          code: item.code || '',
          areaName: item.areaName || '',
          location: item.location || '',
          hasPetArea: item.hasPetArea || false,
          rampCount: item.rampCount || 0,
          remark: item.remark || '',
          status: item.status || 'draft',
          importedBy: state.currentUser,
          importedAt: new Date().toISOString(),
          currentVersion: 1,
          inspectionId: item.inspectionId,
        };
        newRemarks.push(newRemark);
        newVersions.push({
          id: generateId('v'),
          remarkId: newRemark.id,
          version: 1,
          data: newRemark,
          changedBy: state.currentUser,
          changedAt: new Date().toISOString(),
          changeReason: '批量导入新增',
        });
      }
    });

    set((state) => ({
      redlineRemarks: [
        ...state.redlineRemarks.filter((r) => !updatedRemarks.find((u) => u.id === r.id)),
        ...updatedRemarks,
        ...newRemarks,
      ],
      redlineVersions: [...state.redlineVersions, ...newVersions],
    }));

    return {
      total: items.length,
      newItems,
      updatedItems,
      skippedItems: items.length - newItems - updatedItems,
      duplicates,
    };
  },

  getVersionsForRemark: (remarkId) => {
    return get().redlineVersions
      .filter((v) => v.remarkId === remarkId)
      .sort((a, b) => b.version - a.version);
  },

  addComplaint: (complaint) => {
    const newComplaint: Complaint = {
      ...complaint,
      id: generateId('c'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      complaints: [...state.complaints, newComplaint],
    }));
  },

  updateComplaintStatus: (id, status, note) => {
    set((state) => ({
      complaints: state.complaints.map((c) =>
        c.id === id 
          ? { 
              ...c, 
              status, 
              updatedAt: new Date().toISOString(),
              ...(note && status === 'pending_traffic_review' && { rampSupplementNote: note }),
              ...(note && status === 'rectifying' && c.status === 'pending_traffic_review' && { trafficReviewNote: note }),
            } 
          : c
      ),
    }));
  },

  updateComplaintScore: (id, newScore, calculation) => {
    const state = get();
    const complaint = state.complaints.find((c) => c.id === id);
    const previousScore = complaint?.currentScore;
    
    const newCalculation: ScoreCalculation = {
      ...calculation,
      id: generateId('sc'),
      complaintId: id,
      calculatedAt: new Date().toISOString(),
    };

    if (previousScore === newScore) {
      set((state) => ({
        complaints: state.complaints.map((c) =>
          c.id === id 
            ? { ...c, status: 'pending_traffic_review', assignee: 'traffic', updatedAt: new Date().toISOString() } 
            : c
        ),
        scoreCalculations: [...state.scoreCalculations, newCalculation],
      }));
    } else {
      set((state) => ({
        complaints: state.complaints.map((c) =>
          c.id === id 
            ? { ...c, currentScore: newScore, previousScore, updatedAt: new Date().toISOString() } 
            : c
        ),
        scoreCalculations: [...state.scoreCalculations, newCalculation],
      }));
    }
  },

  generateReport: (complaintId) => {
    const state = get();
    const complaint = state.complaints.find((c) => c.id === complaintId);
    const redlineRemark = state.redlineRemarks.find((r) => r.id === complaint?.redlineRemarkId);
    const inspection = state.inspections.find((i) => i.id === complaint?.inspectionId);
    
    const suggestions = [];
    const materialList: string[] = [];
    
    if (inspection?.rampIssues && inspection.rampIssues.length > 0) {
      suggestions.push({
        id: generateId('s'),
        content: `整改坡道问题：${inspection.rampIssues.join('、')}`,
        reason: '网格员巡查发现的安全隐患，需及时处理防止事故发生',
        priority: 'high' as const,
        requiredMaterials: ['防滑垫', '坡道边缘加固条', '警示标识'],
        handler: '物业维修组',
      });
      materialList.push('防滑垫', '坡道边缘加固条', '警示标识');
    }
    
    if (redlineRemark && !redlineRemark.hasPetArea && inspection && inspection.petAreaComplaints > 3) {
      suggestions.push({
        id: generateId('s'),
        content: '规划新的宠物活动区域',
        reason: `该区域宠物相关投诉累计${inspection.petAreaComplaints}起，居民需求强烈，建议统筹规划`,
        priority: 'medium' as const,
        requiredMaterials: ['规划图纸', '居民意见征集表', '区域标识'],
        handler: '社区书记周姐',
      });
      materialList.push('规划图纸', '居民意见征集表');
    }

    const nextHandler = suggestions.some(s => s.handler.includes('交通')) 
      ? 'traffic' as const 
      : suggestions.some(s => s.handler.includes('周姐')) 
        ? 'zhoujie' as const 
        : 'grid' as const;

    const report: Report = {
      id: generateId('r'),
      complaintId,
      generatedAt: new Date().toISOString(),
      generatedBy: state.currentUser,
      suggestions,
      materialList: [...new Set(materialList)],
      nextHandler,
      notes: `该投诉经过${inspection ? '网格员实地巡查' : '红线图比对'}，${suggestions.length > 0 ? '发现以下问题需处理' : '整体情况良好建议持续关注'}。请${nextHandler === 'zhoujie' ? '社区书记周姐' : nextHandler === 'traffic' ? '交通协管' : '网格员'}跟进落实。`,
    };

    set((state) => ({
      reports: [...state.reports, report],
    }));

    return report;
  },

  getComplaintWithRelations: (id) => {
    const state = get();
    const complaint = state.complaints.find((c) => c.id === id);
    return {
      complaint,
      redlineRemark: state.redlineRemarks.find((r) => r.id === complaint?.redlineRemarkId),
      inspection: state.inspections.find((i) => i.id === complaint?.inspectionId),
      calculation: state.scoreCalculations.find((sc) => sc.complaintId === id),
      report: state.reports.find((r) => r.complaintId === id),
    };
  },
}));
