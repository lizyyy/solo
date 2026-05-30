import fs from 'fs';
import path from 'path';
import type { Track, TimelineEvent, Conflict, ImportBatch } from '../shared/types';
import { mockTracks, mockTimelineEvents, mockConflicts, mockImportBatches } from './mockData';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'app-data.json');

interface DataStore {
  tracks: Track[];
  timelineEvents: TimelineEvent[];
  conflicts: Conflict[];
  importBatches: ImportBatch[];
}

let inMemoryStore: DataStore = {
  tracks: [],
  timelineEvents: [],
  conflicts: [],
  importBatches: [],
};

let isInitialized = false;

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromFile = (): DataStore | null => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load data from file:', error);
  }
  return null;
};

const saveToFile = (data: DataStore) => {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save data to file:', error);
  }
};

export const initializeStore = () => {
  if (isInitialized) return;

  const savedData = loadFromFile();
  if (savedData) {
    inMemoryStore = savedData;
  } else {
    inMemoryStore = {
      tracks: mockTracks,
      timelineEvents: mockTimelineEvents,
      conflicts: mockConflicts,
      importBatches: mockImportBatches,
    };
    saveToFile(inMemoryStore);
  }

  isInitialized = true;
};

const persist = () => saveToFile(inMemoryStore);

export const getTracks = (): Track[] => [...inMemoryStore.tracks];

export const getTrackById = (id: string): Track | undefined =>
  inMemoryStore.tracks.find(t => t.id === id);

export const getTrackByTrackId = (trackId: string): Track | undefined =>
  inMemoryStore.tracks.find(t => t.trackId === trackId);

export const addTrack = (track: Track) => {
  inMemoryStore.tracks.push(track);
  persist();
};

export const updateTrack = (track: Track) => {
  const index = inMemoryStore.tracks.findIndex(t => t.id === track.id);
  if (index !== -1) {
    inMemoryStore.tracks[index] = track;
    persist();
  }
};

export const getTimelineEvents = (trackId: string): TimelineEvent[] =>
  inMemoryStore.timelineEvents
    .filter(e => e.trackId === trackId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

export const addTimelineEvent = (event: TimelineEvent) => {
  inMemoryStore.timelineEvents.push(event);
  persist();
};

export const getConflicts = (): Conflict[] => [...inMemoryStore.conflicts];

export const getConflictsByTrackId = (trackId: string): Conflict[] =>
  inMemoryStore.conflicts.filter(c => c.trackId === trackId);

export const addConflict = (conflict: Conflict) => {
  inMemoryStore.conflicts.push(conflict);
  persist();
};

export const updateConflict = (conflict: Conflict) => {
  const index = inMemoryStore.conflicts.findIndex(c => c.id === conflict.id);
  if (index !== -1) {
    inMemoryStore.conflicts[index] = conflict;
    persist();
  }
};

export const getImportBatches = (): ImportBatch[] =>
  [...inMemoryStore.importBatches].sort((a, b) =>
    new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
  );

export const addImportBatch = (batch: ImportBatch) => {
  inMemoryStore.importBatches.push(batch);
  persist();
};

export const getDashboardStats = () => {
  const tracks = getTracks();
  const conflicts = getConflicts();

  const emotionDistribution = {
    happy: { algorithm: 0, manual: 0 },
    sad: { algorithm: 0, manual: 0 },
    energetic: { algorithm: 0, manual: 0 },
    calm: { algorithm: 0, manual: 0 },
    romantic: { algorithm: 0, manual: 0 },
    angry: { algorithm: 0, manual: 0 },
    nostalgic: { algorithm: 0, manual: 0 },
    hopeful: { algorithm: 0, manual: 0 },
  };

  tracks.forEach(track => {
    track.algorithmTags.forEach(tag => {
      emotionDistribution[tag].algorithm++;
    });
    track.manualTags.forEach(tag => {
      emotionDistribution[tag].manual++;
    });
  });

  const conflictTrackIds = new Set(conflicts.map(c => c.trackId));

  return {
    totalTracks: tracks.length,
    conflictCount: conflicts.filter(c => !c.resolved).length,
    resolvedCount: conflicts.filter(c => c.resolved).length,
    copyrightRemoved: tracks.filter(t => t.copyrightStatus === 'removed').length,
    pendingCount: tracks.filter(t => t.status === 'pending').length,
    emotionDistribution,
  };
};

export const resetToMockData = () => {
  inMemoryStore = {
    tracks: mockTracks,
    timelineEvents: mockTimelineEvents,
    conflicts: mockConflicts,
    importBatches: mockImportBatches,
  };
  persist();
};
