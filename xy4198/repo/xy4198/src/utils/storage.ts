import { Level, SimulationRecord } from '../models/types';
import { cloneLevel } from '../models/level';

const LEVELS_STORAGE_KEY = 'smoke_evacuation_levels';
const CURRENT_LEVEL_KEY = 'smoke_evacuation_current_level';

export function saveLevel(level: Level): void {
  const levels = loadAllLevels();
  const existingIndex = levels.findIndex(l => l.id === level.id);
  
  if (existingIndex >= 0) {
    levels[existingIndex] = cloneLevel(level);
  } else {
    levels.push(cloneLevel(level));
  }
  
  localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify(levels));
}

export function loadLevel(id: string): Level | null {
  const levels = loadAllLevels();
  const level = levels.find(l => l.id === id);
  return level ? cloneLevel(level) : null;
}

export function loadAllLevels(): Level[] {
  const stored = localStorage.getItem(LEVELS_STORAGE_KEY);
  if (!stored) return [];
  
  try {
    const parsed = JSON.parse(stored) as Level[];
    return parsed;
  } catch {
    return [];
  }
}

export function deleteLevel(id: string): void {
  const levels = loadAllLevels();
  const filtered = levels.filter(l => l.id !== id);
  localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify(filtered));
}

export function saveCurrentLevel(level: Level): void {
  localStorage.setItem(CURRENT_LEVEL_KEY, JSON.stringify(cloneLevel(level)));
}

export function loadCurrentLevel(): Level | null {
  const stored = localStorage.getItem(CURRENT_LEVEL_KEY);
  if (!stored) return null;
  
  try {
    const parsed = JSON.parse(stored) as Level;
    return cloneLevel(parsed);
  } catch {
    return null;
  }
}

export function exportLevelToJSON(level: Level): string {
  return JSON.stringify(level, null, 2);
}

export function importLevelFromJSON(jsonString: string): Level | null {
  try {
    const parsed = JSON.parse(jsonString) as Level;
    
    if (
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number' ||
      !Array.isArray(parsed.walls) ||
      !Array.isArray(parsed.exits) ||
      !Array.isArray(parsed.smokeSources) ||
      !Array.isArray(parsed.customers) ||
      !Array.isArray(parsed.signs)
    ) {
      return null;
    }
    
    return cloneLevel(parsed);
  } catch {
    return null;
  }
}

export function exportSimulationRecord(record: SimulationRecord): string {
  return JSON.stringify(record, null, 2);
}

export function importSimulationRecord(jsonString: string): SimulationRecord | null {
  try {
    const parsed = JSON.parse(jsonString) as SimulationRecord;
    
    if (
      !parsed.level ||
      !Array.isArray(parsed.states)
    ) {
      return null;
    }
    
    return parsed;
  } catch {
    return null;
  }
}

export function downloadFile(content: string, filename: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function uploadFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('未选择文件'));
      }
    };
    
    input.oncancel = () => {
      reject(new Error('取消选择文件'));
    };
    
    input.click();
  });
}

export async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const content = event.target?.result as string;
      resolve(content);
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsText(file);
  });
}
