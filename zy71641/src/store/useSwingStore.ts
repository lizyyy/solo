import { create } from 'zustand';
import { 
  SwingAnalysisStore, 
  SwingSession, 
  Anomaly, 
  Keyframe, 
  SupplementRecord, 
  ImportResult,
  ImportConflict,
  PanelType,
  CameraState,
} from '@/types';
import { detectAllAnomalies, detectDataCompleteness } from '@/utils/anomalyDetector';
import { computeDataFingerprint, isDuplicate, isUpdate, isConflict, getConflictingFields } from '@/utils/dataFingerprint';
import { createVersion, addVersionToSession, computeDiff, createSupplementRecord, markFramesAsSupplemented } from '@/utils/versionControl';
import { saveSession, getAllSessions, getSessionsByFingerprint } from '@/utils/storage';
import { generateMockSession } from '@/utils/mockData';

const generateId = (): string => 
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const initialState = {
  currentSession: null,
  sessions: [],
  selectedFrameIndex: 0,
  isPlaying: false,
  playbackSpeed: 1.0,
  cameraState: {
    position: { x: 3, y: 2, z: 4 },
    target: { x: 0, y: 1, z: 0 },
  },
  showTrajectory: true,
  showClubHead: true,
  showImpactPoint: true,
  showGrid: true,
  selectedObjectId: null,
  selectedAnomalyId: null,
  selectedKeyframeId: null,
  activePanel: 'params' as PanelType,
  showAlertBar: false,
};

export const useSwingStore = create<SwingAnalysisStore>((set, get) => ({
  ...initialState,

  setCurrentSession: (session: SwingSession | null) => set({ 
    currentSession: session,
    selectedFrameIndex: 0,
    isPlaying: false,
  }),

  updateSession: (updates: Partial<SwingSession>) => set((state) => {
    if (!state.currentSession) return {};
    const updatedSession = { ...state.currentSession, ...updates };
    return { currentSession: updatedSession };
  }),

  setSelectedFrame: (index: number | ((prev: number) => number)) => set((state) => ({ 
    selectedFrameIndex: typeof index === 'function' ? index(state.selectedFrameIndex) : index 
  })),

  setPlaying: (playing: boolean) => set({ isPlaying: playing }),

  setPlaybackSpeed: (speed: number) => set({ playbackSpeed: Math.max(0.25, Math.min(4, speed)) }),

  updateParameter: (frameIndex: number, param: string, value: any) => set((state) => {
    if (!state.currentSession) return {};
    
    const frames = [...state.currentSession.frames];
    const frame = { ...frames[frameIndex] };
    
    const paramParts = param.split('.');
    if (paramParts.length === 2) {
      const [group, field] = paramParts;
      (frame as any)[group] = {
        ...(frame as any)[group],
        [field]: value,
      };
    } else {
      (frame as any)[param] = value;
    }
    
    frames[frameIndex] = frame;
    
    const oldSession = state.currentSession;
    const diff = computeDiff(
      { [param]: paramParts.length === 2 ? (oldSession.frames[frameIndex] as any)[paramParts[0]][paramParts[1]] : (oldSession.frames[frameIndex] as any)[param] },
      { [param]: value }
    );
    
    const version = createVersion(
      oldSession,
      'update',
      '教练',
      `更新帧 ${frameIndex} 的 ${param} 参数`,
      diff
    );
    
    const updatedSession = addVersionToSession(
      { ...oldSession, frames },
      version
    );
    
    return { currentSession: updatedSession };
  }),

  supplementData: (supplement: Omit<SupplementRecord, 'supplementId' | 'supplementedAt'>) => set((state) => {
    if (!state.currentSession) return {};
    
    const supplementRecord = createSupplementRecord(supplement);
    const updatedSession = markFramesAsSupplemented(state.currentSession, supplementRecord);
    
    const version = createVersion(
      state.currentSession,
      'supplement',
      supplement.supplementedBy,
      `补录${supplement.fieldType}数据`,
      { supplement: supplementRecord }
    );
    
    const finalSession = addVersionToSession(updatedSession, version);
    
    return { currentSession: finalSession };
  }),

  detectAnomalies: () => set((state) => {
    if (!state.currentSession) return {};
    
    const anomalies = detectAllAnomalies(state.currentSession);
    const dataCompleteness = detectDataCompleteness(state.currentSession);
    
    const version = createVersion(
      state.currentSession,
      'update',
      '系统',
      `自动检测到 ${anomalies.length} 个异常`,
      { anomalies, dataCompleteness }
    );
    
    const updatedSession = addVersionToSession(
      {
        ...state.currentSession,
        anomalies,
        dataCompleteness,
      },
      version
    );
    
    return { 
      currentSession: updatedSession,
      showAlertBar: anomalies.length > 0,
    };
  }),

  confirmAnomaly: (anomalyId: string, confirmed: boolean) => set((state) => {
    if (!state.currentSession) return {};
    
    const anomalies = state.currentSession.anomalies.map(a => {
      if (a.anomalyId === anomalyId) {
        return {
          ...a,
          isConfirmed: confirmed,
          isFalsePositive: !confirmed,
          confirmedBy: '教练',
          confirmedAt: new Date(),
        };
      }
      return a;
    });
    
    return {
      currentSession: {
        ...state.currentSession,
        anomalies,
      },
    };
  }),

  addKeyframe: (keyframe: Omit<Keyframe, 'keyframeId' | 'createdAt'>) => set((state) => {
    if (!state.currentSession) return {};
    
    const newKeyframe: Keyframe = {
      ...keyframe,
      keyframeId: generateId(),
      createdAt: new Date(),
    };
    
    return {
      currentSession: {
        ...state.currentSession,
        keyframes: [...state.currentSession.keyframes, newKeyframe],
      },
    };
  }),

  importData: async (data: any): Promise<ImportResult> => {
    const state = get();
    let incomingSession: SwingSession;
    
    if (data && typeof data === 'object' && 'frames' in data) {
      incomingSession = data as SwingSession;
    } else {
      incomingSession = generateMockSession();
    }
    
    const fingerprint = await computeDataFingerprint(incomingSession);
    incomingSession.dataFingerprint = fingerprint;
    
    const existingSessions = await getSessionsByFingerprint(fingerprint);
    
    if (existingSessions.length > 0) {
      const existing = existingSessions[0];
      
      if (isDuplicate(existing, incomingSession)) {
        return {
          resultType: 'duplicate',
          existingSessionId: existing.sessionId,
          conflicts: [],
          updatedFields: [],
        };
      }
      
      if (isConflict(existing, incomingSession)) {
        const conflicts = getConflictingFields(existing, incomingSession).map(f => ({
          ...f,
          resolution: 'keep' as const,
        }));
        
        return {
          resultType: 'conflict',
          existingSessionId: existing.sessionId,
          conflicts,
          updatedFields: [],
        };
      }
      
      if (isUpdate(existing, incomingSession)) {
        const updatedFields = ['frames.velocity', 'metadata'];
        return {
          resultType: 'update',
          existingSessionId: existing.sessionId,
          conflicts: [],
          updatedFields,
        };
      }
    }
    
    const version = createVersion(
      incomingSession,
      'import',
      '系统',
      '导入新的挥杆数据',
      { source: incomingSession.importSource }
    );
    
    const sessionWithVersion = addVersionToSession(incomingSession, version);
    sessionWithVersion.anomalies = detectAllAnomalies(sessionWithVersion);
    sessionWithVersion.dataCompleteness = detectDataCompleteness(sessionWithVersion);
    
    await saveSession(sessionWithVersion);
    
    set({
      currentSession: sessionWithVersion,
      sessions: [...state.sessions, sessionWithVersion],
      showAlertBar: sessionWithVersion.anomalies.length > 0,
    });
    
    return {
      resultType: 'new',
      conflicts: [],
      updatedFields: [],
    };
  },

  resolveConflict: (conflict: ImportConflict, resolution: 'keep' | 'replace') => set((state) => {
    if (!state.currentSession) return {};
    
    const updatedConflicts = state.currentSession.anomalies.map(a => ({ ...a }));
    
    return {
      currentSession: {
        ...state.currentSession,
        anomalies: updatedConflicts,
      },
    };
  }),

  saveSession: async () => {
    const state = get();
    if (!state.currentSession) return;
    
    await saveSession(state.currentSession);
    
    const sessions = await getAllSessions();
    set({ sessions });
  },

  exportReport: async (format: 'pdf' | 'png'): Promise<void> => {
    console.log(`Exporting report as ${format}...`);
    return new Promise((resolve) => setTimeout(resolve, 1000));
  },

  loadSessions: async () => {
    const sessions = await getAllSessions();
    
    if (sessions.length === 0) {
      const mockSession = generateMockSession();
      const fingerprint = await computeDataFingerprint(mockSession);
      mockSession.dataFingerprint = fingerprint;
      mockSession.anomalies = detectAllAnomalies(mockSession);
      mockSession.dataCompleteness = detectDataCompleteness(mockSession);
      
      const version = createVersion(
        mockSession,
        'create',
        '系统',
        '创建示例挥杆数据',
        {}
      );
      
      const sessionWithVersion = addVersionToSession(mockSession, version);
      await saveSession(sessionWithVersion);
      
      set({ 
        sessions: [sessionWithVersion],
        currentSession: sessionWithVersion,
        showAlertBar: sessionWithVersion.anomalies.length > 0,
      });
    } else {
      set({ 
        sessions,
        currentSession: sessions[0],
        showAlertBar: sessions[0].anomalies.length > 0,
      });
    }
  },

  setSelectedObject: (id: string | null) => set({ selectedObjectId: id }),

  flyToFrame: (frameIndex: number) => {
    const state = get();
    if (!state.currentSession || frameIndex < 0 || frameIndex >= state.currentSession.frames.length) return;
    
    const frame = state.currentSession.frames[frameIndex];
    const targetPos = frame.position;
    
    set({
      selectedFrameIndex: frameIndex,
      cameraState: {
        position: {
          x: targetPos.x + 2,
          y: targetPos.y + 1.5,
          z: targetPos.z + 2.5,
        },
        target: targetPos,
      },
    });
  },

  setCameraState: (cameraState: Partial<CameraState>) => set((state) => ({
    cameraState: { ...state.cameraState, ...cameraState },
  })),

  setShowTrajectory: (show: boolean) => set({ showTrajectory: show }),
  setShowClubHead: (show: boolean) => set({ showClubHead: show }),
  setShowImpactPoint: (show: boolean) => set({ showImpactPoint: show }),
  setShowGrid: (show: boolean) => set({ showGrid: show }),

  setActivePanel: (panel: PanelType) => set({ activePanel: panel }),
  setShowAlertBar: (show: boolean) => set({ showAlertBar: show }),
  setSelectedAnomalyId: (id: string | null) => set({ selectedAnomalyId: id }),
  setSelectedKeyframeId: (id: string | null) => set({ selectedKeyframeId: id }),
}));
