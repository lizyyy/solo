import { create } from 'zustand';
import type {
  Project,
  SubtitleTrack,
  SubtitleEntry,
  EditPoint,
  AlignmentIssue,
  Segment,
  AdjustmentRecord,
  TimelineState,
  PlaybackState,
} from '@/types';
import {
  saveProject as dbSaveProject,
  getProject as dbGetProject,
  getAllProjects as dbGetAllProjects,
  deleteProject as dbDeleteProject,
  saveTrack as dbSaveTrack,
  getTracksByProject as dbGetTracksByProject,
  saveEntries as dbSaveEntries,
  getEntriesByTrack as dbGetEntriesByTrack,
  saveEditPoint as dbSaveEditPoint,
  getEditPointsByProject as dbGetEditPointsByProject,
  deleteEditPoint as dbDeleteEditPoint,
  saveIssue as dbSaveIssue,
  getIssuesByProject as dbGetIssuesByProject,
  saveSegment as dbSaveSegment,
  getSegmentsByProject as dbGetSegmentsByProject,
  saveAdjustment as dbSaveAdjustment,
  getAllAdjustmentsByProject as dbGetAllAdjustmentsByProject,
} from '@/utils/db';
import { runAllDetections } from '@/utils/alignmentEngine';
import { parseSRT, parseVTT, generateSRT, generateVTT } from '@/utils/subtitleParser';

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  tracks: SubtitleTrack[];
  entries: SubtitleEntry[];
  editPoints: EditPoint[];
  issues: AlignmentIssue[];
  segments: Segment[];
  adjustments: AdjustmentRecord[];
  timeline: TimelineState;
  playback: PlaybackState;
  isLoading: boolean;
  rightPanel: 'issues' | 'edit' | null;
  editingEntry: SubtitleEntry | null;

  loadProjects: () => Promise<void>;
  createProject: (
    name: string,
    audioFileName: string,
    audioDuration: number,
    audioFileHash: string,
  ) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addTrack: (track: SubtitleTrack) => Promise<void>;
  updateTrack: (trackId: string, updates: Partial<SubtitleTrack>) => Promise<void>;
  removeTrack: (trackId: string) => Promise<void>;
  updateEntry: (
    entryId: string,
    updates: Partial<SubtitleEntry>,
    operator: string,
  ) => Promise<void>;
  addEditPoint: (point: EditPoint) => Promise<void>;
  updateEditPoint: (id: string, updates: Partial<EditPoint>) => Promise<void>;
  removeEditPoint: (id: string) => Promise<void>;
  runAlignmentCheck: () => Promise<void>;
  resolveIssue: (
    issueId: string,
    resolution: string,
    resolvedBy: string,
  ) => Promise<void>;
  dismissIssue: (issueId: string) => Promise<void>;
  updateSegment: (segmentId: string, updates: Partial<Segment>) => Promise<void>;
  setTimeline: (updates: Partial<TimelineState>) => void;
  setPlayback: (updates: Partial<PlaybackState>) => void;
  setRightPanel: (panel: 'issues' | 'edit' | null) => void;
  setEditingEntry: (entry: SubtitleEntry | null) => void;
  exportData: (
    projectId: string,
    language: string,
    format: 'srt' | 'vtt',
  ) => string;
  importSubtitles: (
    projectId: string,
    language: string,
    text: string,
    format: 'srt' | 'vtt',
  ) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  tracks: [],
  entries: [],
  editPoints: [],
  issues: [],
  segments: [],
  adjustments: [],
  timeline: {
    zoom: 1,
    scrollX: 0,
    playheadPosition: 0,
    selectedSegmentId: null,
    visibleTracks: [],
  },
  playback: {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
  },
  isLoading: false,
  rightPanel: null,
  editingEntry: null,

  loadProjects: async () => {
    set({ isLoading: true });
    const projects = await dbGetAllProjects();
    set({ projects, isLoading: false });
  },

  createProject: async (name, audioFileName, audioDuration, audioFileHash) => {
    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      audioFileName,
      audioDuration,
      audioFileHash,
      createdAt: now,
      updatedAt: now,
    };
    await dbSaveProject(project);
    set((state) => ({ projects: [...state.projects, project] }));
  },

  openProject: async (id) => {
    set({ isLoading: true });
    const project = await dbGetProject(id);
    if (!project) {
      set({ isLoading: false });
      return;
    }
    const tracks = await dbGetTracksByProject(id);
    const allEntries: SubtitleEntry[] = [];
    for (const track of tracks) {
      const trackEntries = await dbGetEntriesByTrack(track.id);
      allEntries.push(...trackEntries);
    }
    const editPoints = await dbGetEditPointsByProject(id);
    const issues = await dbGetIssuesByProject(id);
    const segments = await dbGetSegmentsByProject(id);
    const adjustments = await dbGetAllAdjustmentsByProject(id);
    set({
      currentProject: project,
      tracks,
      entries: allEntries,
      editPoints,
      issues,
      segments,
      adjustments,
      isLoading: false,
    });
  },

  deleteProject: async (id) => {
    await dbDeleteProject(id);
    set((state) => {
      const isCurrent = state.currentProject?.id === id;
      return {
        projects: state.projects.filter((p) => p.id !== id),
        ...(isCurrent
          ? {
              currentProject: null,
              tracks: [],
              entries: [],
              editPoints: [],
              issues: [],
              segments: [],
              adjustments: [],
            }
          : {}),
      };
    });
  },

  addTrack: async (track) => {
    await dbSaveTrack(track);
    set((state) => ({ tracks: [...state.tracks, track] }));
  },

  updateTrack: async (trackId, updates) => {
    const track = get().tracks.find((t) => t.id === trackId);
    if (!track) return;
    const updated = { ...track, ...updates };
    await dbSaveTrack(updated);
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? updated : t,
      ),
    }));
  },

  removeTrack: async (trackId) => {
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
      entries: state.entries.filter((e) => e.trackId !== trackId),
    }));
  },

  updateEntry: async (entryId, updates, operator) => {
    const entry = get().entries.find((e) => e.id === entryId);
    if (!entry) return;

    const fieldsToTrack: (keyof Pick<
      SubtitleEntry,
      'startTime' | 'endTime' | 'text'
    >)[] = ['startTime', 'endTime', 'text'];
    const newAdjustments: AdjustmentRecord[] = [];

    for (const field of fieldsToTrack) {
      if (updates[field] !== undefined && updates[field] !== entry[field]) {
        newAdjustments.push({
          id: crypto.randomUUID(),
          entryId,
          timestamp: Date.now(),
          operator,
          field,
          oldValue: String(entry[field]),
          newValue: String(updates[field]),
        });
      }
    }

    const isManuallyAdjusted =
      updates.isManuallyAdjusted ??
      (newAdjustments.length > 0 ? true : entry.isManuallyAdjusted);

    const adjustmentHistory = newAdjustments.length > 0
      ? [...entry.adjustmentHistory, ...newAdjustments.map((a) => a.id)]
      : entry.adjustmentHistory;

    const updatedEntry: SubtitleEntry = {
      ...entry,
      ...updates,
      isManuallyAdjusted,
      adjustmentHistory,
    };

    await dbSaveEntries([updatedEntry]);
    for (const adj of newAdjustments) {
      await dbSaveAdjustment(adj);
    }

    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === entryId ? updatedEntry : e,
      ),
      adjustments: [...state.adjustments, ...newAdjustments],
    }));
  },

  addEditPoint: async (point) => {
    await dbSaveEditPoint(point);
    set((state) => ({ editPoints: [...state.editPoints, point] }));
  },

  updateEditPoint: async (id, updates) => {
    const point = get().editPoints.find((p) => p.id === id);
    if (!point) return;
    const updated = { ...point, ...updates };
    await dbSaveEditPoint(updated);
    set((state) => ({
      editPoints: state.editPoints.map((p) =>
        p.id === id ? updated : p,
      ),
    }));
  },

  removeEditPoint: async (id) => {
    await dbDeleteEditPoint(id);
    set((state) => ({
      editPoints: state.editPoints.filter((p) => p.id !== id),
    }));
  },

  runAlignmentCheck: async () => {
    const { tracks, entries, currentProject } = get();
    if (!currentProject) return;

    const issues = runAllDetections(
      currentProject.audioDuration,
      tracks,
      entries,
    );

    const projectIssues: AlignmentIssue[] = issues.map((r) => ({
      ...r,
      projectId: currentProject.id,
      status: 'open' as const,
    }));

    for (const issue of projectIssues) {
      await dbSaveIssue(issue);
    }

    set({ issues: projectIssues });
  },

  resolveIssue: async (issueId, resolution, resolvedBy) => {
    const now = Date.now();
    const issue = get().issues.find((i) => i.id === issueId);
    if (!issue) return;
    const updated: AlignmentIssue = {
      ...issue,
      status: 'resolved',
      resolution,
      resolvedBy,
      resolvedAt: now,
    };
    await dbSaveIssue(updated);
    set((state) => ({
      issues: state.issues.map((i) =>
        i.id === issueId ? updated : i,
      ),
    }));
  },

  dismissIssue: async (issueId) => {
    const issue = get().issues.find((i) => i.id === issueId);
    if (!issue) return;
    const updated: AlignmentIssue = { ...issue, status: 'dismissed' };
    await dbSaveIssue(updated);
    set((state) => ({
      issues: state.issues.map((i) =>
        i.id === issueId ? updated : i,
      ),
    }));
  },

  updateSegment: async (segmentId, updates) => {
    const segment = get().segments.find((s) => s.id === segmentId);
    if (!segment) return;
    const updated = { ...segment, ...updates };
    await dbSaveSegment(updated);
    set((state) => ({
      segments: state.segments.map((s) =>
        s.id === segmentId ? updated : s,
      ),
    }));
  },

  setTimeline: (updates) => {
    set((state) => ({ timeline: { ...state.timeline, ...updates } }));
  },

  setPlayback: (updates) => {
    set((state) => ({ playback: { ...state.playback, ...updates } }));
  },

  setRightPanel: (panel) => {
    set({ rightPanel: panel });
  },

  setEditingEntry: (entry) => {
    set({ editingEntry: entry });
  },

  exportData: (projectId, language, format) => {
    const { tracks, entries } = get();
    const track = tracks.find(
      (t) => t.projectId === projectId && t.language === language,
    );
    if (!track) return '';
    const trackEntries = entries
      .filter((e) => e.trackId === track.id)
      .sort((a, b) => a.index - b.index);
    return format === 'srt'
      ? generateSRT(trackEntries)
      : generateVTT(trackEntries);
  },

  importSubtitles: async (projectId, language, text, format) => {
    const parsed = format === 'srt' ? parseSRT(text) : parseVTT(text);
    const trackId = crypto.randomUUID();

    const existingTracks = get().tracks.filter(
      (t) => t.projectId === projectId && t.language === language,
    );
    const uploadVersion =
      existingTracks.length > 0
        ? Math.max(...existingTracks.map((t) => t.uploadVersion)) + 1
        : 1;

    const track: SubtitleTrack = {
      id: trackId,
      projectId,
      language,
      label: `${language} v${uploadVersion}`,
      entries: [],
      uploadVersion,
    };

    const newEntries: SubtitleEntry[] = parsed.map((item, index) => ({
      id: crypto.randomUUID(),
      trackId,
      index,
      startTime: item.startTime,
      endTime: item.endTime,
      text: item.text,
      originalStartTime: item.startTime,
      originalEndTime: item.endTime,
      originalText: item.text,
      isManuallyAdjusted: false,
      adjustmentHistory: [],
    }));

    track.entries = newEntries.map((e) => e.id);

    await dbSaveTrack(track);
    await dbSaveEntries(newEntries);

    set((state) => ({
      tracks: [...state.tracks, track],
      entries: [...state.entries, ...newEntries],
    }));
  },
}));
