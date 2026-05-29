import { create } from 'zustand';
import { Pattern, DrumTrack, Note, ValidationIssue, HistoryVersion } from '@/types';
import { generateId, validatePattern } from '@/utils/validation';

const createDefaultNotes = (): Note[] => {
  return Array.from({ length: 16 }, (_, i) => ({
    id: generateId(),
    step: i,
    velocity: 80,
    isActive: false,
  }));
};

const defaultTracks: DrumTrack[] = [
  {
    id: generateId(),
    name: 'Kick',
    color: '#00F0FF',
    sampleUrl: 'kick',
    volume: 0.8,
    pan: 0,
    notes: createDefaultNotes(),
    muted: false,
    solo: false,
  },
  {
    id: generateId(),
    name: 'Snare',
    color: '#FF6B35',
    sampleUrl: 'snare',
    volume: 0.7,
    pan: 0,
    notes: createDefaultNotes(),
    muted: false,
    solo: false,
  },
  {
    id: generateId(),
    name: 'Hi-Hat',
    color: '#00FF88',
    sampleUrl: 'hihat',
    volume: 0.6,
    pan: 0,
    notes: createDefaultNotes(),
    muted: false,
    solo: false,
  },
  {
    id: generateId(),
    name: 'Clap',
    color: '#FF3366',
    sampleUrl: 'clap',
    volume: 0.7,
    pan: 0,
    notes: createDefaultNotes(),
    muted: false,
    solo: false,
  },
];

const createDefaultPattern = (): Pattern => ({
  id: generateId(),
  name: '未命名 Pattern',
  bpm: 120,
  steps: 16,
  tracks: defaultTracks,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  author: '匿名用户',
  isDirty: false,
});

interface PatternState {
  pattern: Pattern;
  issues: ValidationIssue[];
  history: HistoryVersion[];
  filterTracks: string[];
  setPattern: (pattern: Pattern) => void;
  setBpm: (bpm: number) => void;
  setSteps: (steps: 16 | 32) => void;
  toggleNote: (trackId: string, step: number) => void;
  setVelocity: (trackId: string, step: number, velocity: number) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  addTrack: (name: string, color: string) => void;
  removeTrack: (trackId: string) => void;
  renamePattern: (name: string) => void;
  saveVersion: (message: string) => void;
  restoreVersion: (versionId: string) => void;
  runValidation: () => void;
  clearPattern: () => void;
  setFilterTracks: (trackIds: string[]) => void;
  fixIssue: (issueId: string) => void;
}

const loadFromStorage = (): Pattern | null => {
  try {
    const saved = localStorage.getItem('drumPattern');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const loadHistoryFromStorage = (): HistoryVersion[] => {
  try {
    const saved = localStorage.getItem('patternHistory');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const usePatternStore = create<PatternState>((set, get) => ({
  pattern: loadFromStorage() || createDefaultPattern(),
  issues: [],
  history: loadHistoryFromStorage(),
  filterTracks: [],

  setPattern: (pattern) => {
    set({ pattern: { ...pattern, isDirty: true, updatedAt: new Date().toISOString() } });
    localStorage.setItem('drumPattern', JSON.stringify(pattern));
    get().runValidation();
  },

  setBpm: (bpm) => {
    set((state) => ({
      pattern: { ...state.pattern, bpm, isDirty: true, updatedAt: new Date().toISOString() },
    }));
    localStorage.setItem('drumPattern', JSON.stringify(get().pattern));
  },

  setSteps: (steps) => {
    set((state) => {
      const newTracks = state.pattern.tracks.map((track) => {
        if (steps > track.notes.length) {
          const newNotes = Array.from({ length: steps - track.notes.length }, (_, i) => ({
            id: generateId(),
            step: track.notes.length + i,
            velocity: 80,
            isActive: false,
          }));
          return { ...track, notes: [...track.notes, ...newNotes] };
        }
        return { ...track, notes: track.notes.slice(0, steps) };
      });
      return {
        pattern: {
          ...state.pattern,
          steps,
          tracks: newTracks,
          isDirty: true,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    localStorage.setItem('drumPattern', JSON.stringify(get().pattern));
    get().runValidation();
  },

  toggleNote: (trackId, step) => {
    set((state) => ({
      pattern: {
        ...state.pattern,
        tracks: state.pattern.tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                notes: track.notes.map((note) =>
                  note.step === step ? { ...note, isActive: !note.isActive } : note
                ),
              }
            : track
        ),
        isDirty: true,
        updatedAt: new Date().toISOString(),
      },
    }));
    localStorage.setItem('drumPattern', JSON.stringify(get().pattern));
    get().runValidation();
  },

  setVelocity: (trackId, step, velocity) => {
    set((state) => ({
      pattern: {
        ...state.pattern,
        tracks: state.pattern.tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                notes: track.notes.map((note) =>
                  note.step === step ? { ...note, velocity } : note
                ),
              }
            : track
        ),
        isDirty: true,
        updatedAt: new Date().toISOString(),
      },
    }));
    localStorage.setItem('drumPattern', JSON.stringify(get().pattern));
    get().runValidation();
  },

  setTrackVolume: (trackId, volume) => {
    set((state) => ({
      pattern: {
        ...state.pattern,
        tracks: state.pattern.tracks.map((track) =>
          track.id === trackId ? { ...track, volume } : track
        ),
        isDirty: true,
      },
    }));
    localStorage.setItem('drumPattern', JSON.stringify(get().pattern));
  },

  toggleMute: (trackId) => {
    set((state) => ({
      pattern: {
        ...state.pattern,
        tracks: state.pattern.tracks.map((track) =>
          track.id === trackId ? { ...track, muted: !track.muted } : track
        ),
      },
    }));
  },

  toggleSolo: (trackId) => {
    set((state) => {
      const hasSolo = state.pattern.tracks.some((t) => t.solo && t.id !== trackId);
      return {
        pattern: {
          ...state.pattern,
          tracks: state.pattern.tracks.map((track) =>
            track.id === trackId
              ? { ...track, solo: !track.solo }
              : hasSolo ? track : { ...track, solo: false }
          ),
        },
      };
    });
  },

  addTrack: (name, color) => {
    const newTrack: DrumTrack = {
      id: generateId(),
      name,
      color,
      sampleUrl: name.toLowerCase(),
      volume: 0.7,
      pan: 0,
      notes: Array.from({ length: get().pattern.steps }, (_, i) => ({
        id: generateId(),
        step: i,
        velocity: 80,
        isActive: false,
      })),
      muted: false,
      solo: false,
    };
    set((state) => ({
      pattern: {
        ...state.pattern,
        tracks: [...state.pattern.tracks, newTrack],
        isDirty: true,
        updatedAt: new Date().toISOString(),
      },
    }));
    localStorage.setItem('drumPattern', JSON.stringify(get().pattern));
  },

  removeTrack: (trackId) => {
    set((state) => ({
      pattern: {
        ...state.pattern,
        tracks: state.pattern.tracks.filter((track) => track.id !== trackId),
        isDirty: true,
        updatedAt: new Date().toISOString(),
      },
    }));
    localStorage.setItem('drumPattern', JSON.stringify(get().pattern));
    get().runValidation();
  },

  renamePattern: (name) => {
    set((state) => ({
      pattern: { ...state.pattern, name, isDirty: true },
    }));
  },

  saveVersion: (message) => {
    const version: HistoryVersion = {
      id: generateId(),
      patternId: get().pattern.id,
      snapshot: JSON.parse(JSON.stringify(get().pattern)),
      timestamp: new Date().toISOString(),
      author: get().pattern.author,
      message,
      isConflict: false,
    };
    set((state) => {
      const newHistory = [version, ...state.history].slice(0, 20);
      localStorage.setItem('patternHistory', JSON.stringify(newHistory));
      return { history: newHistory, pattern: { ...state.pattern, isDirty: false } };
    });
  },

  restoreVersion: (versionId) => {
    const version = get().history.find((v) => v.id === versionId);
    if (version) {
      set({
        pattern: { ...version.snapshot, isDirty: true },
      });
      localStorage.setItem('drumPattern', JSON.stringify(version.snapshot));
      get().runValidation();
    }
  },

  runValidation: () => {
    const issues = validatePattern(get().pattern);
    set({ issues });
  },

  clearPattern: () => {
    const newPattern = createDefaultPattern();
    set({ pattern: newPattern });
    localStorage.setItem('drumPattern', JSON.stringify(newPattern));
    get().runValidation();
  },

  setFilterTracks: (trackIds) => {
    set({ filterTracks: trackIds });
  },

  fixIssue: (issueId) => {
    const issue = get().issues.find((i) => i.id === issueId);
    if (!issue) return;

    if (issue.type === 'velocity_over') {
      get().setVelocity(issue.trackId, issue.step, 90);
    } else if (issue.type === 'velocity_low') {
      get().setVelocity(issue.trackId, issue.step, 50);
    } else if (issue.type === 'density_high') {
      const track = get().pattern.tracks.find((t) => t.id === issue.trackId);
      if (track) {
        const notesInWindow = track.notes.filter(
          (n) => n.isActive && n.step >= issue.step && n.step < issue.step + 3
        );
        if (notesInWindow.length >= 2) {
          get().toggleNote(issue.trackId, notesInWindow[notesInWindow.length - 1].step);
        }
      }
    }
  },
}));
