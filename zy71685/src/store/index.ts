import { create } from 'zustand';
import {
  Rehearsal,
  AudioTrack,
  VoicePart,
  ScoreSection,
  Misnote,
  OperationLog,
  Comment,
  Report,
  DetectionRun,
  FilterCriteria,
  DEFAULT_FILTERS,
  PitchDetectionResult,
  SeparationResult,
  generateId,
  MisnoteStatistics,
} from '@/types';
import { db, clearDatabase } from '@/db';
import { misnoteAnalyzer } from '@/algorithms/misnoteAnalyzer';
import { detectionEngine, DetectionConfig, DEFAULT_DETECTION_CONFIG } from '@/algorithms/detectionEngine';
import {
  generateMockRehearsal,
  generateMockVoiceParts,
  generateMockScoreSections,
  generateMockMisnotes,
  generateMockOperationLogs,
  generateMockComments,
  generateMockReports,
  generateMockAudioData,
} from '@/utils/mockData';
import { exportReport } from '@/utils/exportService';

interface AppState {
  rehearsals: Rehearsal[];
  currentRehearsal: Rehearsal | null;
  audioTrack: AudioTrack | null;
  voiceParts: VoicePart[];
  scoreSections: ScoreSection[];
  detectionRuns: DetectionRun[];
  misnotes: Misnote[];
  comments: Comment[];
  reports: Report[];
  operationLogs: OperationLog[];

  pitchResults: PitchDetectionResult[];
  separationResults: SeparationResult[];

  playbackTime: number;
  isPlaying: boolean;
  viewRange: [number, number];
  selectionRange: [number, number] | null;
  filters: FilterCriteria;
  selectedMisnoteId: string | null;
  audioContext: AudioContext | null;
  audioBuffer: AudioBuffer | null;
  audioSource: AudioBufferSourceNode | null;
  gainNode: GainNode | null;

  isAnalyzing: boolean;
  analysisProgress: number;

  statistics: MisnoteStatistics | null;
  filteredMisnotes: Misnote[];

  loadInitialData: () => Promise<void>;
  setCurrentRehearsal: (id: string) => Promise<void>;
  uploadAudio: (file: File) => Promise<void>;
  runDetection: (config?: Partial<DetectionConfig>, timeRange?: [number, number]) => Promise<void>;
  rerunDetection: (runId: string) => Promise<void>;
  confirmMisnote: (id: string, note?: string) => Promise<void>;
  rejectMisnote: (id: string, note?: string) => Promise<void>;
  addManualMisnote: (data: Partial<Misnote>) => Promise<void>;
  addComment: (misnoteId: string, content: string, authorName: string, isTeacher: boolean) => Promise<void>;
  undoOperation: (logId: string) => Promise<void>;
  setFilters: (filters: Partial<FilterCriteria>) => void;
  resetFilters: () => void;
  selectMisnote: (id: string | null) => void;
  setPlaybackTime: (time: number) => void;
  togglePlayback: () => Promise<void>;
  stopPlayback: () => void;
  setViewRange: (range: [number, number]) => void;
  setSelectionRange: (range: [number, number] | null) => void;
  zoomView: (factor: number) => void;
  seekToTime: (time: number, autoplay?: boolean) => Promise<void>;
  exportReport: (format: 'pdf' | 'xlsx', includeCharts?: boolean) => Promise<void>;
  recalculateStatistics: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  rehearsals: [],
  currentRehearsal: null,
  audioTrack: null,
  voiceParts: [],
  scoreSections: [],
  detectionRuns: [],
  misnotes: [],
  comments: [],
  reports: [],
  operationLogs: [],

  pitchResults: [],
  separationResults: [],

  playbackTime: 0,
  isPlaying: false,
  viewRange: [0, 180],
  selectionRange: null,
  filters: { ...DEFAULT_FILTERS },
  selectedMisnoteId: null,
  audioContext: null,
  audioBuffer: null,
  audioSource: null,
  gainNode: null,

  isAnalyzing: false,
  analysisProgress: 0,

  statistics: null,
  filteredMisnotes: [],

  loadInitialData: async () => {
    try {
      await db.open();
    } catch (error) {
      console.warn('Database open failed, deleting and recreating:', error);
      await db.delete();
      await db.open();
    }

    let storedRehearsals: Rehearsal[] = [];
    try {
      storedRehearsals = await db.rehearsals.orderBy('createdAt').reverse().toArray();
    } catch (error) {
      console.warn('Failed to query rehearsals, clearing database:', error);
      await clearDatabase();
      storedRehearsals = [];
    }

    if (storedRehearsals.length === 0) {
      const mockRehearsal = generateMockRehearsal();
      const duration = 180;

      try {
        await db.transaction('rw', db.tables, async () => {
          await db.rehearsals.add(mockRehearsal);

          const voiceParts = generateMockVoiceParts(mockRehearsal.id);
          await db.voiceParts.bulkAdd(voiceParts);

          const scoreSections = generateMockScoreSections(mockRehearsal.id, duration);
          await db.scoreSections.bulkAdd(scoreSections);

          const { detectionRun, misnotes } = generateMockMisnotes(mockRehearsal.id, voiceParts, duration);
          await db.detectionRuns.add(detectionRun);
          await db.misnotes.bulkAdd(misnotes);

          const audioTrack: AudioTrack = {
            id: generateId(),
            rehearsalId: mockRehearsal.id,
            name: '排练录音.wav',
            filePath: '/mock/audio.wav',
            duration,
            sourceType: 'system',
            createdAt: new Date(),
            sampleRate: 44100,
          };
          await db.audioTracks.add(audioTrack);

          const operationLogs = generateMockOperationLogs(mockRehearsal.id, misnotes);
          await db.operationLogs.bulkAdd(operationLogs);

          const comments = generateMockComments(misnotes);
          await db.comments.bulkAdd(comments);

          const reports = generateMockReports(mockRehearsal.id);
          await db.reports.bulkAdd(reports);
        });
      } catch (error) {
        console.error('Failed to create mock data:', error);
        await clearDatabase();
        throw error;
      }

      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioData = generateMockAudioData(duration);
      const audioBuffer = audioContext.createBuffer(2, audioData.length, 44100);
      audioBuffer.getChannelData(0).set(audioData);
      audioBuffer.getChannelData(1).set(audioData);

      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);

      const pitchResults = generateMockPitchResults(duration);
      const separationResults = generateMockSeparationResults(duration);

      const loadedRehearsal = await db.rehearsals.get(mockRehearsal.id);
      const loadedVoiceParts = await db.voiceParts.where('rehearsalId').equals(mockRehearsal.id).toArray();
      const loadedScoreSections = await db.scoreSections.where('rehearsalId').equals(mockRehearsal.id).toArray();
      const loadedDetectionRuns = await db.detectionRuns.where('rehearsalId').equals(mockRehearsal.id).toArray();
      const loadedMisnotes = await db.misnotes.where('rehearsalId').equals(mockRehearsal.id).toArray();
      const loadedComments = await db.comments.toArray();
      const loadedReports = await db.reports.where('rehearsalId').equals(mockRehearsal.id).toArray();
      const loadedLogs = await db.operationLogs.where('rehearsalId').equals(mockRehearsal.id).toArray();
      const loadedAudioTrack = await db.audioTracks.where('rehearsalId').equals(mockRehearsal.id).first();

      const filtered = misnoteAnalyzer.applyFilters(loadedMisnotes, get().filters);
      const stats = misnoteAnalyzer.analyze(loadedMisnotes, get().filters);

      set({
        rehearsals: [loadedRehearsal!],
        currentRehearsal: loadedRehearsal!,
        audioTrack: loadedAudioTrack || null,
        voiceParts: loadedVoiceParts,
        scoreSections: loadedScoreSections,
        detectionRuns: loadedDetectionRuns,
        misnotes: loadedMisnotes,
        comments: loadedComments,
        reports: loadedReports,
        operationLogs: loadedLogs,
        audioContext,
        audioBuffer,
        gainNode,
        pitchResults,
        separationResults,
        viewRange: [0, duration],
        filteredMisnotes: filtered,
        statistics: stats,
      });
    } else {
      const firstRehearsal = storedRehearsals[0];
      await get().setCurrentRehearsal(firstRehearsal.id);
    }
  },

  setCurrentRehearsal: async (id: string) => {
    const rehearsal = await db.rehearsals.get(id);
    if (!rehearsal) return;

    const [voiceParts, scoreSections, detectionRuns, misnotes, reports, logs, audioTrack] =
      await Promise.all([
        db.voiceParts.where('rehearsalId').equals(id).toArray(),
        db.scoreSections.where('rehearsalId').equals(id).toArray(),
        db.detectionRuns.where('rehearsalId').equals(id).toArray(),
        db.misnotes.where('rehearsalId').equals(id).toArray(),
        db.reports.where('rehearsalId').equals(id).toArray(),
        db.operationLogs.where('rehearsalId').equals(id).toArray(),
        db.audioTracks.where('rehearsalId').equals(id).first(),
      ]);

    const comments = await db.comments.filter((c) => misnotes.some((m) => m.id === c.misnoteId)).toArray();

    const filtered = misnoteAnalyzer.applyFilters(misnotes, get().filters);
    const stats = misnoteAnalyzer.analyze(misnotes, get().filters);

    set({
      currentRehearsal: rehearsal,
      voiceParts,
      scoreSections,
      detectionRuns,
      misnotes,
      comments,
      reports,
      operationLogs: logs,
      audioTrack: audioTrack || null,
      playbackTime: 0,
      isPlaying: false,
      selectedMisnoteId: null,
      viewRange: audioTrack ? [0, audioTrack.duration] : [0, 180],
      filteredMisnotes: filtered,
      statistics: stats,
    });
  },

  uploadAudio: async (file: File) => {
    const { currentRehearsal } = get();
    if (!currentRehearsal) return;

    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);

    const audioTrack: AudioTrack = {
      id: generateId(),
      rehearsalId: currentRehearsal.id,
      name: file.name,
      filePath: URL.createObjectURL(file),
      duration: audioBuffer.duration,
      sourceType: 'system',
      createdAt: new Date(),
      sampleRate: audioBuffer.sampleRate,
    };

    await db.audioTracks.add(audioTrack);

    set({
      audioTrack,
      audioContext,
      audioBuffer,
      gainNode,
      viewRange: [0, audioBuffer.duration],
    });
  },

  runDetection: async (config?: Partial<DetectionConfig>, timeRange?: [number, number]) => {
    const { audioBuffer, voiceParts, scoreSections, currentRehearsal, misnotes } = get();
    if (!audioBuffer || !currentRehearsal) return;

    set({ isAnalyzing: true, analysisProgress: 0 });

    const fullConfig: DetectionConfig = { ...DEFAULT_DETECTION_CONFIG, ...config };

    try {
      set({ analysisProgress: 10 });

      const result = await detectionEngine.runDetection(
        audioBuffer,
        voiceParts,
        scoreSections,
        fullConfig,
        timeRange,
        currentRehearsal.id
      );

      set({ analysisProgress: 70 });

      const detectionRun: DetectionRun = {
        id: generateId(),
        rehearsalId: currentRehearsal.id,
        type: timeRange ? 'partial' : 'full',
        config: JSON.stringify(fullConfig),
        status: 'completed',
        startedAt: new Date(),
        finishedAt: new Date(),
        timeRangeStart: timeRange?.[0],
        timeRangeEnd: timeRange?.[1],
      };

      await db.detectionRuns.add(detectionRun);

      let allMisnotes: Misnote[];
      if (timeRange) {
        const [start, end] = timeRange;
        allMisnotes = [
          ...misnotes.filter((m) => m.time < start || m.time > end),
          ...result.misnotes,
        ].sort((a, b) => a.time - b.time);

        await db.misnotes.where('time').between(start, end).delete();
        await db.misnotes.bulkAdd(result.misnotes);
      } else {
        allMisnotes = result.misnotes;
        await db.misnotes.clear();
        await db.misnotes.bulkAdd(result.misnotes);
      }

      const log: OperationLog = {
        id: generateId(),
        rehearsalId: currentRehearsal.id,
        operationType: timeRange ? 'rerun' : 'detection_run',
        targetEntity: 'misnote',
        targetId: detectionRun.id,
        snapshotBefore: JSON.stringify({ count: misnotes.length }),
        snapshotAfter: JSON.stringify({ count: allMisnotes.length }),
        operator: '李老师',
        note: timeRange ? `重新计算了 ${timeRange[0].toFixed(1)}s - ${timeRange[1].toFixed(1)}s 区域` : '运行了完整检测',
        createdAt: new Date(),
      };
      await db.operationLogs.add(log);

      const filtered = misnoteAnalyzer.applyFilters(allMisnotes, get().filters);
      const stats = misnoteAnalyzer.analyze(allMisnotes, get().filters);

      set({
        misnotes: allMisnotes,
        detectionRuns: [...get().detectionRuns, detectionRun],
        operationLogs: [...get().operationLogs, log],
        pitchResults: result.pitchResults,
        separationResults: result.separationResults,
        filteredMisnotes: filtered,
        statistics: stats,
        isAnalyzing: false,
        analysisProgress: 100,
      });
    } catch (error) {
      console.error('Detection failed:', error);
      set({ isAnalyzing: false, analysisProgress: 0 });
    }
  },

  rerunDetection: async (runId: string) => {
    const run = get().detectionRuns.find((r) => r.id === runId);
    if (run?.timeRangeStart !== undefined && run?.timeRangeEnd !== undefined) {
      const config = JSON.parse(run.config);
      await get().runDetection(config, [run.timeRangeStart, run.timeRangeEnd]);
    } else {
      await get().runDetection();
    }
  },

  confirmMisnote: async (id: string, note?: string) => {
    const { misnotes, currentRehearsal } = get();
    if (!currentRehearsal) return;

    const misnote = misnotes.find((m) => m.id === id);
    if (!misnote) return;

    const beforeSnapshot = JSON.stringify(misnote);
    const updatedMisnote = { ...misnote, confirmationStatus: 'confirmed' as const };
    const afterSnapshot = JSON.stringify(updatedMisnote);

    await db.misnotes.update(id, { confirmationStatus: 'confirmed' });

    const log: OperationLog = {
      id: generateId(),
      rehearsalId: currentRehearsal.id,
      operationType: 'confirm',
      targetEntity: 'misnote',
      targetId: id,
      snapshotBefore: beforeSnapshot,
      snapshotAfter: afterSnapshot,
      operator: '李老师',
      note,
      createdAt: new Date(),
    };
    await db.operationLogs.add(log);

    const newMisnotes = misnotes.map((m) => (m.id === id ? updatedMisnote : m));
    const filtered = misnoteAnalyzer.applyFilters(newMisnotes, get().filters);
    const stats = misnoteAnalyzer.analyze(newMisnotes, get().filters);

    set({
      misnotes: newMisnotes,
      operationLogs: [...get().operationLogs, log],
      filteredMisnotes: filtered,
      statistics: stats,
    });
  },

  rejectMisnote: async (id: string, note?: string) => {
    const { misnotes, currentRehearsal } = get();
    if (!currentRehearsal) return;

    const misnote = misnotes.find((m) => m.id === id);
    if (!misnote) return;

    const beforeSnapshot = JSON.stringify(misnote);
    const updatedMisnote = { ...misnote, confirmationStatus: 'rejected' as const };
    const afterSnapshot = JSON.stringify(updatedMisnote);

    await db.misnotes.update(id, { confirmationStatus: 'rejected' });

    const log: OperationLog = {
      id: generateId(),
      rehearsalId: currentRehearsal.id,
      operationType: 'reject',
      targetEntity: 'misnote',
      targetId: id,
      snapshotBefore: beforeSnapshot,
      snapshotAfter: afterSnapshot,
      operator: '李老师',
      note,
      createdAt: new Date(),
    };
    await db.operationLogs.add(log);

    const newMisnotes = misnotes.map((m) => (m.id === id ? updatedMisnote : m));
    const filtered = misnoteAnalyzer.applyFilters(newMisnotes, get().filters);
    const stats = misnoteAnalyzer.analyze(newMisnotes, get().filters);

    set({
      misnotes: newMisnotes,
      operationLogs: [...get().operationLogs, log],
      filteredMisnotes: filtered,
      statistics: stats,
    });
  },

  addManualMisnote: async (data: Partial<Misnote>) => {
    const { misnotes, currentRehearsal, voiceParts } = get();
    if (!currentRehearsal) return;

    const newMisnote: Misnote = {
      id: generateId(),
      rehearsalId: currentRehearsal.id,
      detectionRunId: generateId(),
      voicePartId: data.voicePartId || voiceParts[0]?.id || '',
      time: data.time || 0,
      duration: data.duration || 0.2,
      problemType: data.problemType || 'noise_misjudgment',
      expectedPitch: data.expectedPitch || '',
      actualPitch: data.actualPitch || '',
      deviationCents: data.deviationCents || 50,
      confidence: 1,
      confirmationStatus: 'pending',
      sourceType: 'manual',
      createdAt: new Date(),
      notes: data.notes,
    };

    await db.misnotes.add(newMisnote);

    const log: OperationLog = {
      id: generateId(),
      rehearsalId: currentRehearsal.id,
      operationType: 'manual_add',
      targetEntity: 'misnote',
      targetId: newMisnote.id,
      snapshotBefore: JSON.stringify({ count: misnotes.length }),
      snapshotAfter: JSON.stringify({ count: misnotes.length + 1 }),
      operator: '李老师',
      note: '人工补录了一个错音标记',
      createdAt: new Date(),
    };
    await db.operationLogs.add(log);

    const newMisnotes = [...misnotes, newMisnote].sort((a, b) => a.time - b.time);
    const filtered = misnoteAnalyzer.applyFilters(newMisnotes, get().filters);
    const stats = misnoteAnalyzer.analyze(newMisnotes, get().filters);

    set({
      misnotes: newMisnotes,
      operationLogs: [...get().operationLogs, log],
      filteredMisnotes: filtered,
      statistics: stats,
    });
  },

  addComment: async (misnoteId: string, content: string, authorName: string, isTeacher: boolean) => {
    const { currentRehearsal } = get();
    if (!currentRehearsal) return;

    const comment: Comment = {
      id: generateId(),
      misnoteId,
      authorType: isTeacher ? 'teacher' : 'student',
      authorName,
      content,
      createdAt: new Date(),
    };

    await db.comments.add(comment);

    const log: OperationLog = {
      id: generateId(),
      rehearsalId: currentRehearsal.id,
      operationType: 'comment_add',
      targetEntity: 'comment',
      targetId: comment.id,
      snapshotBefore: '',
      snapshotAfter: JSON.stringify(comment),
      operator: authorName,
      note: isTeacher ? '老师添加了备注' : '学生添加了备注',
      createdAt: new Date(),
    };
    await db.operationLogs.add(log);

    set({
      comments: [...get().comments, comment],
      operationLogs: [...get().operationLogs, log],
    });
  },

  undoOperation: async (logId: string) => {
    const { operationLogs, currentRehearsal, misnotes } = get();
    if (!currentRehearsal) return;

    const log = operationLogs.find((l) => l.id === logId);
    if (!log) return;

    if (log.operationType === 'confirm' || log.operationType === 'reject') {
      const before = JSON.parse(log.snapshotBefore);
      await db.misnotes.update(log.targetId, { confirmationStatus: before.confirmationStatus });

      const newMisnotes = misnotes.map((m) =>
        m.id === log.targetId ? { ...m, confirmationStatus: before.confirmationStatus } : m
      );
      const filtered = misnoteAnalyzer.applyFilters(newMisnotes, get().filters);
      const stats = misnoteAnalyzer.analyze(newMisnotes, get().filters);

      const undoLog: OperationLog = {
        id: generateId(),
        rehearsalId: currentRehearsal.id,
        operationType: 'undo',
        targetEntity: 'misnote',
        targetId: log.targetId,
        snapshotBefore: log.snapshotAfter,
        snapshotAfter: log.snapshotBefore,
        operator: '李老师',
        note: `撤回了"${log.note}"操作`,
        createdAt: new Date(),
      };
      await db.operationLogs.add(undoLog);

      set({
        misnotes: newMisnotes,
        operationLogs: [...operationLogs, undoLog],
        filteredMisnotes: filtered,
        statistics: stats,
      });
    } else if (log.operationType === 'manual_add') {
      await db.misnotes.delete(log.targetId);

      const newMisnotes = misnotes.filter((m) => m.id !== log.targetId);
      const filtered = misnoteAnalyzer.applyFilters(newMisnotes, get().filters);
      const stats = misnoteAnalyzer.analyze(newMisnotes, get().filters);

      const undoLog: OperationLog = {
        id: generateId(),
        rehearsalId: currentRehearsal.id,
        operationType: 'undo',
        targetEntity: 'misnote',
        targetId: log.targetId,
        snapshotBefore: JSON.stringify({ count: misnotes.length }),
        snapshotAfter: JSON.stringify({ count: newMisnotes.length }),
        operator: '李老师',
        note: `撤回了人工补录操作`,
        createdAt: new Date(),
      };
      await db.operationLogs.add(undoLog);

      set({
        misnotes: newMisnotes,
        operationLogs: [...operationLogs, undoLog],
        filteredMisnotes: filtered,
        statistics: stats,
      });
    }
  },

  setFilters: (filters: Partial<FilterCriteria>) => {
    const newFilters = { ...get().filters, ...filters };
    const filtered = misnoteAnalyzer.applyFilters(get().misnotes, newFilters);
    const stats = misnoteAnalyzer.analyze(get().misnotes, newFilters);

    set({ filters: newFilters, filteredMisnotes: filtered, statistics: stats });
  },

  resetFilters: () => {
    const filtered = misnoteAnalyzer.applyFilters(get().misnotes, DEFAULT_FILTERS);
    const stats = misnoteAnalyzer.analyze(get().misnotes, DEFAULT_FILTERS);

    set({ filters: { ...DEFAULT_FILTERS }, filteredMisnotes: filtered, statistics: stats });
  },

  selectMisnote: (id: string | null) => {
    set({ selectedMisnoteId: id });
  },

  setPlaybackTime: (time: number) => {
    set({ playbackTime: time });
  },

  togglePlayback: async () => {
    const { isPlaying, audioContext, audioBuffer, gainNode, playbackTime, audioTrack } = get();

    if (!audioContext || !audioBuffer || !gainNode) return;

    if (isPlaying) {
      get().audioSource?.stop();
      set({ isPlaying: false, audioSource: null });
    } else {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);

      const startTime = Math.min(playbackTime, audioBuffer.duration);
      source.start(0, startTime);

      source.onended = () => {
        if (get().isPlaying) {
          set({ isPlaying: false, audioSource: null, playbackTime: 0 });
        }
      };

      const duration = audioTrack?.duration || audioBuffer.duration;
      const updateTime = () => {
        if (get().isPlaying) {
          const elapsed = (Date.now() - startTime * 1000) / 1000;
          const newTime = Math.min(startTime + elapsed, duration);
          set({ playbackTime: newTime });
          if (newTime < duration) {
            requestAnimationFrame(updateTime);
          }
        }
      };
      requestAnimationFrame(updateTime);

      set({ isPlaying: true, audioSource: source });
    }
  },

  stopPlayback: () => {
    get().audioSource?.stop();
    set({ isPlaying: false, audioSource: null });
  },

  setViewRange: (range: [number, number]) => {
    set({ viewRange: range });
  },

  setSelectionRange: (range: [number, number] | null) => {
    set({ selectionRange: range });
  },

  zoomView: (factor: number) => {
    const { viewRange, audioTrack } = get();
    const [start, end] = viewRange;
    const center = (start + end) / 2;
    const currentDuration = end - start;
    const newDuration = currentDuration / factor;
    const duration = audioTrack?.duration || 180;

    let newStart = center - newDuration / 2;
    let newEnd = center + newDuration / 2;

    if (newStart < 0) {
      newStart = 0;
      newEnd = Math.min(newDuration, duration);
    }
    if (newEnd > duration) {
      newEnd = duration;
      newStart = Math.max(0, duration - newDuration);
    }

    set({ viewRange: [newStart, newEnd] });
  },

  seekToTime: async (time: number, autoplay = false) => {
    const { isPlaying, audioContext, audioBuffer, gainNode, audioTrack } = get();

    set({ playbackTime: time });

    if (isPlaying) {
      get().audioSource?.stop();

      if (audioContext && audioBuffer && gainNode) {
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNode);

        const duration = audioTrack?.duration || audioBuffer.duration;
        const startTime = Math.min(time, duration);
        source.start(0, startTime);

        source.onended = () => {
          if (get().isPlaying) {
            set({ isPlaying: false, audioSource: null, playbackTime: 0 });
          }
        };

        const updateTime = () => {
          if (get().isPlaying) {
            const elapsed = (Date.now() - startTime * 1000) / 1000;
            const newTime = Math.min(startTime + elapsed, duration);
            set({ playbackTime: newTime });
            if (newTime < duration) {
              requestAnimationFrame(updateTime);
            }
          }
        };
        requestAnimationFrame(updateTime);

        set({ audioSource: source });
      }
    } else if (autoplay) {
      await get().togglePlayback();
    }
  },

  exportReport: async (format: 'pdf' | 'xlsx', includeCharts = true) => {
    const {
      currentRehearsal,
      audioTrack,
      viewRange,
      filters,
      filteredMisnotes,
      statistics,
      voiceParts,
      scoreSections,
    } = get();

    if (!currentRehearsal || !audioTrack) return;

    const report = await exportReport(
      {
        format,
        includeCharts,
        includeMisnoteList: true,
        includeComments: true,
        timeRange: viewRange,
        filters,
      },
      {
        rehearsal: currentRehearsal,
        audioTrack,
        misnotes: filteredMisnotes,
        statistics: statistics!,
        voiceParts,
        scoreSections,
        comments: get().comments,
      }
    );

    await db.reports.add(report);
    set({ reports: [...get().reports, report] });

    const log: OperationLog = {
      id: generateId(),
      rehearsalId: currentRehearsal.id,
      operationType: 'export',
      targetEntity: 'report',
      targetId: report.id,
      snapshotBefore: '',
      snapshotAfter: JSON.stringify(report),
      operator: '李老师',
      note: `导出了${format.toUpperCase()}格式报告，范围 ${viewRange[0].toFixed(1)}s - ${viewRange[1].toFixed(1)}s`,
      createdAt: new Date(),
    };
    await db.operationLogs.add(log);
    set({ operationLogs: [...get().operationLogs, log] });
  },

  recalculateStatistics: () => {
    const { misnotes, filters } = get();
    const filtered = misnoteAnalyzer.applyFilters(misnotes, filters);
    const stats = misnoteAnalyzer.analyze(misnotes, filters);
    set({ filteredMisnotes: filtered, statistics: stats });
  },
}));

function generateMockPitchResults(duration: number): PitchDetectionResult[] {
  const results: PitchDetectionResult[] = [];
  const baseFreqs = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];

  for (let t = 0; t < duration; t += 0.05) {
    const baseFreq = baseFreqs[Math.floor(t / 5) % baseFreqs.length];
    const variation = Math.sin(t * 2) * 5;
    let freq = baseFreq + variation;

    if (Math.random() > 0.92) {
      freq *= 0.9 + Math.random() * 0.2;
    }

    results.push({
      time: t,
      frequency: freq,
      probability: 0.6 + Math.random() * 0.4,
    });
  }

  return results;
}

function generateMockSeparationResults(duration: number): SeparationResult[] {
  const results: SeparationResult[] = [];

  for (let t = 0; t < duration; t += 0.1) {
    const violinEnergy = 0.3 + Math.sin(t * 0.8) * 0.3 + Math.random() * 0.2;
    const fluteEnergy = 0.2 + Math.cos(t * 0.6) * 0.2 + Math.random() * 0.15;

    let dominantInstrument: SeparationResult['dominantInstrument'] = 'none';
    const total = violinEnergy + fluteEnergy;
    if (total > 0.3) {
      const vRatio = violinEnergy / total;
      const fRatio = fluteEnergy / total;
      if (vRatio > 0.6) dominantInstrument = 'violin';
      else if (fRatio > 0.6) dominantInstrument = 'flute';
      else dominantInstrument = 'both';
    }

    results.push({
      time: t,
      dominantInstrument,
      violinEnergy: Math.min(1, violinEnergy),
      fluteEnergy: Math.min(1, fluteEnergy),
    });
  }

  return results;
}
