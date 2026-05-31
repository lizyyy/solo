import { create } from 'zustand';
import {
  AnomalyPhoto,
  ScanReport,
  ValidationResult,
  OperationLog,
  PhotoTag,
  PointStatus,
} from '../types';
import {
  mockPhotos,
  mockScanReports,
  mockValidationResults,
  mockOperationLogs,
} from '../data/mockData';

interface AppState {
  photos: AnomalyPhoto[];
  scanReports: ScanReport[];
  validationResults: ValidationResult[];
  operationLogs: OperationLog[];
  selectedPhotoId: string | null;
  selectedReportId: string | null;
  selectedPointId: string | null;
  filterTags: PhotoTag[];
  searchKeyword: string;
}

interface AppActions {
  setSelectedPhotoId: (id: string | null) => void;
  setSelectedReportId: (id: string | null) => void;
  setSelectedPointId: (id: string | null) => void;
  setFilterTags: (tags: PhotoTag[]) => void;
  setSearchKeyword: (keyword: string) => void;
  addPhoto: (photo: Omit<AnomalyPhoto, 'id'>) => void;
  updatePhotoTags: (photoId: string, tags: PhotoTag[]) => void;
  addCorrection: (photoId: string, content: string, author: string) => void;
  linkPointToPhoto: (reportId: string, pointId: string, photoId: string) => void;
  updatePointStatus: (reportId: string, pointId: string, status: PointStatus) => void;
  runValidation: () => ValidationResult[];
  addOperationLog: (log: Omit<OperationLog, 'id' | 'timestamp'>) => void;
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  photos: mockPhotos,
  scanReports: mockScanReports,
  validationResults: mockValidationResults,
  operationLogs: mockOperationLogs,
  selectedPhotoId: null,
  selectedReportId: mockScanReports[0]?.id || null,
  selectedPointId: null,
  filterTags: [],
  searchKeyword: '',

  setSelectedPhotoId: (id) => set({ selectedPhotoId: id }),
  setSelectedReportId: (id) => set({ selectedReportId: id }),
  setSelectedPointId: (id) => set({ selectedPointId: id }),
  setFilterTags: (tags) => set({ filterTags: tags }),
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),

  addPhoto: (photo) => {
    const newPhoto: AnomalyPhoto = {
      ...photo,
      id: `photo-${Date.now()}`,
    };
    set((state) => ({ photos: [...state.photos, newPhoto] }));
    get().addOperationLog({
      action: '上传照片',
      entityType: 'AnomalyPhoto',
      entityId: newPhoto.id,
      operator: photo.uploader,
      details: `上传异常照片「${photo.name}」`,
    });
  },

  updatePhotoTags: (photoId, tags) => {
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === photoId ? { ...p, tags } : p
      ),
    }));
  },

  addCorrection: (photoId, content, author) => {
    set((state) => ({
      photos: state.photos.map((p) => {
        if (p.id !== photoId) return p;
        const newVersion = p.corrections.length + 1;
        const newCorrection = {
          id: `corr-${photoId}-v${newVersion}`,
          content,
          version: newVersion,
          timestamp: new Date().toLocaleString('zh-CN'),
          author,
          isLatest: true,
        };
        return {
          ...p,
          corrections: [
            ...p.corrections.map((c) => ({ ...c, isLatest: false })),
            newCorrection,
          ],
        };
      }),
    }));
    get().addOperationLog({
      action: '添加批改意见',
      entityType: 'Correction',
      entityId: photoId,
      operator: author,
      details: `为照片 ${photoId} 添加批改意见`,
    });
  },

  linkPointToPhoto: (reportId, pointId, photoId) => {
    set((state) => ({
      scanReports: state.scanReports.map((r) => {
        if (r.id !== reportId) return r;
        return {
          ...r,
          points: r.points.map((p) =>
            p.id === pointId ? { ...p, linkedPhotoId: photoId } : p
          ),
        };
      }),
    }));
    get().addOperationLog({
      action: '关联证据',
      entityType: 'ScanPoint',
      entityId: pointId,
      operator: '当前用户',
      details: `将数据点 ${pointId} 关联到异常照片 ${photoId}`,
    });
  },

  updatePointStatus: (reportId, pointId, status) => {
    set((state) => ({
      scanReports: state.scanReports.map((r) => {
        if (r.id !== reportId) return r;
        return {
          ...r,
          points: r.points.map((p) =>
            p.id === pointId ? { ...p, status } : p
          ),
        };
      }),
    }));
  },

  runValidation: () => {
    return get().validationResults;
  },

  addOperationLog: (log) => {
    const newLog: OperationLog = {
      ...log,
      id: `log-op-${Date.now()}`,
      timestamp: new Date().toLocaleString('zh-CN'),
    };
    set((state) => ({ operationLogs: [newLog, ...state.operationLogs] }));
  },
}));
