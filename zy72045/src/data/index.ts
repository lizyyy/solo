import level1Normal from './sample-levels/level1-normal.json';
import level2Empty from './sample-levels/level2-empty.json';
import level3Duplicate from './sample-levels/level3-duplicate.json';
import level4Boundary from './sample-levels/level4-boundary.json';
import sampleRecords from './sample-records.json';
import type { GameConfig } from '../types/game';
import type { HistoryRecord } from '../types/history';

export const sampleLevels: GameConfig[] = [
  level1Normal as GameConfig,
  level2Empty as GameConfig,
  level3Duplicate as GameConfig,
  level4Boundary as GameConfig,
];

export const defaultLevel = level1Normal as GameConfig;

export const sampleHistoryRecords = sampleRecords as HistoryRecord[];

export const getLevelById = (id: string): GameConfig | undefined => {
  return sampleLevels.find((level) => level.id === id);
};

export const getLevelNames = (): Array<{ id: string; name: string }> => {
  return sampleLevels.map((level) => ({ id: level.id, name: level.name }));
};
