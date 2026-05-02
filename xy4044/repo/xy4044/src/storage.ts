import { Session, ImportResult, ValidationError } from './types';
import { createSession } from './models';
import { validateSession } from './validators';

const STORAGE_KEY = 'av_delay_calibrator_session';

export function saveSessionToStorage(session: Session): boolean {
  try {
    const sessionWithUpdatedTime = {
      ...session,
      updatedAt: Date.now()
    };
    const json = JSON.stringify(sessionWithUpdatedTime);
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (error) {
    console.error('Failed to save session to localStorage:', error);
    return false;
  }
}

export function loadSessionFromStorage(): Session | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;

    const parsed = JSON.parse(json) as Session;
    const validationResult = validateSession(parsed);

    if (!validationResult.success) {
      console.warn('Loaded session validation failed:', validationResult.errors);
      return null;
    }

    return validationResult.data || null;
  } catch (error) {
    console.error('Failed to load session from localStorage:', error);
    return null;
  }
}

export function clearSessionFromStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportSessionToJSON(session: Session): string {
  const exportSession = {
    ...session,
    exportedAt: Date.now()
  };
  return JSON.stringify(exportSession, null, 2);
}

export function importSessionFromJSON(jsonContent: string): ImportResult<Session> {
  try {
    const parsed = JSON.parse(jsonContent) as Session;

    if (parsed.exportedAt !== undefined) {
      const { exportedAt, ...cleaned } = parsed;
      return validateSession(cleaned);
    }

    return validateSession(parsed);
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'json',
        message: `JSON解析失败: ${(error as Error).message}`,
        severity: 'error'
      }],
      warnings: []
    };
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

export function downloadSession(session: Session): void {
  const json = exportSessionToJSON(session);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `session-${session.name.replace(/\s+/g, '_')}-${timestamp}.json`;
  downloadFile(json, filename, 'application/json');
}

export async function loadFileFromInput(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(content);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsText(file);
  });
}

export interface MergeOptions {
  replaceSources: boolean;
  replaceEvents: boolean;
  replaceResults: boolean;
  replaceProblems: boolean;
}

export function mergeSessions(
  current: Session,
  imported: Session,
  options: MergeOptions
): Session {
  const merged: Session = {
    ...current,
    updatedAt: Date.now()
  };

  if (options.replaceSources) {
    merged.sources = imported.sources;
  } else {
    const existingIds = new Set(current.sources.map(s => s.id));
    const newSources = imported.sources.filter(s => !existingIds.has(s.id));
    merged.sources = [...current.sources, ...newSources];
  }

  if (options.replaceEvents) {
    merged.events = imported.events;
  } else {
    const existingIds = new Set(current.events.map(e => e.id));
    const newEvents = imported.events.filter(e => !existingIds.has(e.id));
    merged.events = [...current.events, ...newEvents];
  }

  if (options.replaceResults) {
    merged.calibrationResults = imported.calibrationResults;
  }

  if (options.replaceProblems) {
    merged.problems = imported.problems;
  }

  merged.syncIssues = [];
  merged.importLogs = [...current.importLogs, ...imported.importLogs];

  if (imported.masterClockSourceId) {
    merged.masterClockSourceId = imported.masterClockSourceId;
  }

  return merged;
}
