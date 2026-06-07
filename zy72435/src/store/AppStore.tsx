import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type {
  AudioFileRemark,
  AuthorizationPeriod,
  ComplianceCheck,
  SubstituteSong,
  HistoryEntry,
  User,
  PageType,
} from '../types';
import {
  mockAudioRemarks,
  mockAuthorizationPeriods,
  mockComplianceChecks,
  mockSubstituteSongs,
  currentUser,
} from './mockData';

interface AppState {
  currentUser: User;
  currentPage: PageType;
  audioRemarks: AudioFileRemark[];
  authorizationPeriods: AuthorizationPeriod[];
  complianceChecks: ComplianceCheck[];
  substituteSongs: SubstituteSong[];
  selectedAudioRemarkId: string | null;
  selectedAuthId: string | null;
  selectedComplianceId: string | null;
  previousPage: PageType | null;
}

interface AppContextType extends AppState {
  setCurrentPage: (page: PageType) => void;
  setPreviousPage: (page: PageType | null) => void;
  importAudioRemarks: (remarks: Omit<AudioFileRemark, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'version' | 'isActive'>[]) => { added: number; skipped: number };
  updateAudioRemark: (id: string, updates: Partial<AudioFileRemark>, remark?: string) => void;
  getAudioRemarkHistory: (id: string) => HistoryEntry<AudioFileRemark>[];
  setSelectedAudioRemarkId: (id: string | null) => void;
  setSelectedAuthId: (id: string | null) => void;
  setSelectedComplianceId: (id: string | null) => void;
  updateAuthorization: (id: string, updates: Partial<AuthorizationPeriod>, remark?: string) => void;
  runComplianceCheck: (audioFileId: string) => ComplianceCheck;
  updateComplianceCheck: (id: string, updates: Partial<ComplianceCheck>, remark?: string) => void;
  approveSubstitute: (id: string, remark?: string) => void;
  rejectSubstitute: (id: string, remark: string) => void;
  generateSettlementDetails: () => ComplianceCheck[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const audioRemarkHistoryMap = new Map<string, HistoryEntry<AudioFileRemark>[]>();

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    currentUser,
    currentPage: 'audio_remarks',
    audioRemarks: mockAudioRemarks,
    authorizationPeriods: mockAuthorizationPeriods,
    complianceChecks: mockComplianceChecks,
    substituteSongs: mockSubstituteSongs,
    selectedAudioRemarkId: null,
    selectedAuthId: null,
    selectedComplianceId: null,
    previousPage: null,
  });

  const setCurrentPage = useCallback((page: PageType) => {
    setState(prev => ({ ...prev, previousPage: prev.currentPage, currentPage: page }));
  }, []);

  const setPreviousPage = useCallback((page: PageType | null) => {
    setState(prev => ({ ...prev, previousPage: page }));
  }, []);

  const setSelectedAudioRemarkId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedAudioRemarkId: id }));
  }, []);

  const setSelectedAuthId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedAuthId: id }));
  }, []);

  const setSelectedComplianceId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedComplianceId: id }));
  }, []);

  const importAudioRemarks = useCallback((
    remarks: Omit<AudioFileRemark, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'version' | 'isActive'>[]
  ) => {
    let added = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    setState(prev => {
      const existingHashes = new Set(prev.audioRemarks.map(r => r.fileHash));
      const newRemarks: AudioFileRemark[] = [];

      remarks.forEach(remark => {
        if (existingHashes.has(remark.fileHash)) {
          skipped++;
        } else {
          const newRemark: AudioFileRemark = {
            ...remark,
            id: generateId('audio'),
            createdAt: now,
            updatedAt: now,
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
            version: 1,
            isActive: true,
          };
          newRemarks.push(newRemark);
          existingHashes.add(remark.fileHash);
          added++;

          const history: HistoryEntry<AudioFileRemark>[] = [{
            id: generateId('hist'),
            timestamp: now,
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'import',
            remark: '批量导入音频文件备注',
          }];
          audioRemarkHistoryMap.set(newRemark.id, history);
        }
      });

      return {
        ...prev,
        audioRemarks: [...prev.audioRemarks, ...newRemarks],
      };
    });

    return { added, skipped };
  }, []);

  const updateAudioRemark = useCallback((id: string, updates: Partial<AudioFileRemark>, remark?: string) => {
    const now = new Date().toISOString();

    setState(prev => {
      const updatedRemarks = prev.audioRemarks.map(r => {
        if (r.id === id) {
          const updated = {
            ...r,
            ...updates,
            updatedAt: now,
            updatedBy: currentUser.id,
            version: r.version + 1,
          };

          const history = audioRemarkHistoryMap.get(id) || [];
          Object.entries(updates).forEach(([key, value]) => {
            if (key in r) {
              history.push({
                id: generateId('hist'),
                timestamp: now,
                userId: currentUser.id,
                userName: currentUser.name,
                action: 'update',
                field: key as keyof AudioFileRemark,
                oldValue: r[key as keyof AudioFileRemark],
                newValue: value,
                remark,
              });
            }
          });
          audioRemarkHistoryMap.set(id, history);

          return updated;
        }
        return r;
      });

      return { ...prev, audioRemarks: updatedRemarks };
    });
  }, []);

  const getAudioRemarkHistory = useCallback((id: string) => {
    return audioRemarkHistoryMap.get(id) || [];
  }, []);

  const updateAuthorization = useCallback((id: string, updates: Partial<AuthorizationPeriod>, remark?: string) => {
    const now = new Date().toISOString();

    setState(prev => {
      const updatedAuths = prev.authorizationPeriods.map(auth => {
        if (auth.id === id) {
          const historyEntry: HistoryEntry<AuthorizationPeriod> = {
            id: generateId('hist'),
            timestamp: now,
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'update',
            remark: remark || '更新授权信息',
          };
          return {
            ...auth,
            ...updates,
            updatedAt: now,
            updatedBy: currentUser.id,
            history: [...auth.history, historyEntry],
          };
        }
        return auth;
      });

      return { ...prev, authorizationPeriods: updatedAuths };
    });
  }, []);

  const runComplianceCheck = useCallback((audioFileId: string): ComplianceCheck => {
    const now = new Date().toISOString();
    const audio = state.audioRemarks.find(a => a.id === audioFileId);
    const auth = state.authorizationPeriods.find(a => a.audioFileId === audioFileId);
    const existingCheck = state.complianceChecks.find(c => c.audioFileId === audioFileId);

    if (!audio) {
      throw new Error('音频文件不存在');
    }

    const issues: ComplianceCheck['issues'] = [];

    if (!auth) {
      issues.push({
        id: generateId('issue'),
        type: 'missing_auth',
        severity: 'high',
        description: '缺少授权期限记录',
      });
    } else if (auth.status === 'expired') {
      issues.push({
        id: generateId('issue'),
        type: 'expired_auth',
        severity: 'high',
        description: `授权已于${auth.endDate}过期`,
      });
    } else if (auth.status === 'expiring') {
      issues.push({
        id: generateId('issue'),
        type: 'expired_auth',
        severity: 'medium',
        description: `授权即将在${auth.endDate}到期`,
      });
    }

    if (!audio.remark || audio.remark.length < 5) {
      issues.push({
        id: generateId('issue'),
        type: 'incomplete_remark',
        severity: 'low',
        description: '音频备注信息不完整',
      });
    }

    const substitute = state.substituteSongs.find(
      s => s.substituteSongName === audio.songName && s.status === 'pending_review'
    );
    if (substitute) {
      issues.push({
        id: generateId('issue'),
        type: 'substitute_unverified',
        severity: 'medium',
        description: '临时替补歌曲，需要票务同事复核确认',
      });
    }

    let status: ComplianceCheck['status'] = 'compliant';
    if (issues.some(i => i.severity === 'high')) {
      status = 'non_compliant';
    } else if (issues.length > 0) {
      status = 'needs_review';
    }

    const newCheck: ComplianceCheck = {
      id: existingCheck ? existingCheck.id : generateId('check'),
      audioFileId,
      songName: audio.songName,
      artist: audio.artist,
      checkDate: now,
      status,
      issues,
      checkedBy: currentUser.id,
      remarks: existingCheck?.remarks || '',
      keptReason: existingCheck?.keptReason || '',
      missingMaterials: existingCheck?.missingMaterials || [],
      nextStep: existingCheck?.nextStep || '',
      nextStepOwner: existingCheck?.nextStepOwner || 'tour_coordinator',
      isSubstitute: !!substitute,
      substituteSource: substitute?.sourceType,
      substituteVerified: substitute ? substitute.status === 'approved' : true,
      createdAt: existingCheck?.createdAt || now,
      updatedAt: now,
      history: [
        ...(existingCheck?.history || []),
        {
          id: generateId('hist'),
          timestamp: now,
          userId: currentUser.id,
          userName: currentUser.name,
          action: existingCheck ? 'update' : 'create',
          remark: `执行合规检查，结果：${status}`,
        },
      ],
    };

    setState(prev => {
      const existingIndex = prev.complianceChecks.findIndex(c => c.audioFileId === audioFileId);
      if (existingIndex >= 0) {
        const updated = [...prev.complianceChecks];
        updated[existingIndex] = newCheck;
        return { ...prev, complianceChecks: updated };
      }
      return { ...prev, complianceChecks: [...prev.complianceChecks, newCheck] };
    });

    return newCheck;
  }, [state.audioRemarks, state.authorizationPeriods, state.complianceChecks, state.substituteSongs]);

  const updateComplianceCheck = useCallback((id: string, updates: Partial<ComplianceCheck>, remark?: string) => {
    const now = new Date().toISOString();

    setState(prev => {
      const updatedChecks = prev.complianceChecks.map(check => {
        if (check.id === id) {
          const history: HistoryEntry<ComplianceCheck>[] = [...check.history];

          Object.entries(updates).forEach(([key, value]) => {
            if (key in check) {
              history.push({
                id: generateId('hist'),
                timestamp: now,
                userId: currentUser.id,
                userName: currentUser.name,
                action: 'update',
                field: key as keyof ComplianceCheck,
                oldValue: check[key as keyof ComplianceCheck],
                newValue: value,
                remark,
              });
            }
          });

          return {
            ...check,
            ...updates,
            updatedAt: now,
            history,
          };
        }
        return check;
      });

      return { ...prev, complianceChecks: updatedChecks };
    });
  }, []);

  const approveSubstitute = useCallback((id: string, remark?: string) => {
    const now = new Date().toISOString();

    setState(prev => {
      const updatedSubs = prev.substituteSongs.map(sub => {
        if (sub.id === id) {
          return {
            ...sub,
            status: 'approved' as const,
            reviewedBy: currentUser.id,
            reviewedAt: now,
            reviewRemark: remark,
          };
        }
        return sub;
      });

      const sub = prev.substituteSongs.find(s => s.id === id);
      if (sub) {
        const audioRemark = prev.audioRemarks.find(a => a.songName === sub.substituteSongName);
        if (audioRemark) {
          const updatedChecks = prev.complianceChecks.map(check => {
            if (check.audioFileId === audioRemark.id) {
              return {
                ...check,
                substituteVerified: true,
                status: 'compliant' as const,
                issues: check.issues.filter(i => i.type !== 'substitute_unverified'),
                updatedAt: now,
                history: [
                  ...check.history,
                  {
                    id: generateId('hist'),
                    timestamp: now,
                    userId: currentUser.id,
                    userName: currentUser.name,
                    action: 'update' as const,
                    field: 'substituteVerified' as keyof ComplianceCheck,
                    oldValue: false,
                    newValue: true,
                    remark: '票务同事已复核通过',
                  } as HistoryEntry<ComplianceCheck>,
                ],
              };
            }
            return check;
          });
          return { ...prev, substituteSongs: updatedSubs, complianceChecks: updatedChecks };
        }
      }

      return { ...prev, substituteSongs: updatedSubs };
    });
  }, []);

  const rejectSubstitute = useCallback((id: string, remark: string) => {
    const now = new Date().toISOString();

    setState(prev => {
      const updatedSubs = prev.substituteSongs.map(sub => {
        if (sub.id === id) {
          return {
            ...sub,
            status: 'rejected' as const,
            reviewedBy: currentUser.id,
            reviewedAt: now,
            reviewRemark: remark,
          };
        }
        return sub;
      });

      return { ...prev, substituteSongs: updatedSubs };
    });
  }, []);

  const generateSettlementDetails = useCallback(() => {
    return state.complianceChecks.filter(c => c.status !== 'non_compliant');
  }, [state.complianceChecks]);

  const value: AppContextType = {
    ...state,
    setCurrentPage,
    setPreviousPage,
    importAudioRemarks,
    updateAudioRemark,
    getAudioRemarkHistory,
    setSelectedAudioRemarkId,
    setSelectedAuthId,
    setSelectedComplianceId,
    updateAuthorization,
    runComplianceCheck,
    updateComplianceCheck,
    approveSubstitute,
    rejectSubstitute,
    generateSettlementDetails,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
};
