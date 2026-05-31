import type { GameSession, Level } from '@/types';
import { deepClone } from '@/utils/helpers';

const STORAGE_KEYS = {
  SESSIONS: 'pbc_maze_sessions',
  LEVELS: 'pbc_maze_levels',
  CURRENT_SESSION: 'pbc_maze_current_session',
};

export class LocalStorage {
  static saveSession(session: GameSession): void {
    const sessions = this.getAllSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = deepClone(session);
    } else {
      sessions.unshift(deepClone(session));
    }
    
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    
    if (session.status === 'playing' || session.status === 'paused') {
      this.setCurrentSessionId(session.id);
    }
  }

  static getSession(id: string): GameSession | null {
    const sessions = this.getAllSessions();
    const session = sessions.find((s) => s.id === id);
    return session ? deepClone(session) : null;
  }

  static getAllSessions(): GameSession[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static getSessionsByLevel(levelId: string): GameSession[] {
    return this.getAllSessions().filter((s) => s.levelId === levelId);
  }

  static getSessionsByPlayer(playerName: string): GameSession[] {
    return this.getAllSessions().filter((s) => 
      s.playerName.toLowerCase().includes(playerName.toLowerCase())
    );
  }

  static deleteSession(id: string): void {
    const sessions = this.getAllSessions().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    
    const currentId = this.getCurrentSessionId();
    if (currentId === id) {
      this.setCurrentSessionId(null);
    }
  }

  static clearAllSessions(): void {
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  }

  static setCurrentSessionId(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
    }
  }

  static getCurrentSessionId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
  }

  static getCurrentSession(): GameSession | null {
    const id = this.getCurrentSessionId();
    if (!id) return null;
    return this.getSession(id);
  }

  static saveLevel(level: Level): void {
    const levels = this.getLevels();
    const existingIndex = levels.findIndex((l) => l.id === level.id);
    
    if (existingIndex >= 0) {
      levels[existingIndex] = deepClone(level);
    } else {
      levels.push(deepClone(level));
    }
    
    localStorage.setItem(STORAGE_KEYS.LEVELS, JSON.stringify(levels));
  }

  static saveLevels(levels: Level[]): void {
    const existing = this.getLevels();
    const merged = [...existing];
    
    levels.forEach((level) => {
      const existingIndex = merged.findIndex((l) => l.id === level.id);
      if (existingIndex >= 0) {
        merged[existingIndex] = deepClone(level);
      } else {
        merged.push(deepClone(level));
      }
    });
    
    localStorage.setItem(STORAGE_KEYS.LEVELS, JSON.stringify(merged));
  }

  static getLevel(id: string): Level | null {
    const levels = this.getLevels();
    const level = levels.find((l) => l.id === id);
    return level ? deepClone(level) : null;
  }

  static getLevels(): Level[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LEVELS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static deleteLevel(id: string): void {
    const levels = this.getLevels().filter((l) => l.id !== id);
    localStorage.setItem(STORAGE_KEYS.LEVELS, JSON.stringify(levels));
  }

  static clearAllLevels(): void {
    localStorage.removeItem(STORAGE_KEYS.LEVELS);
  }

  static exportAllData(): {
    sessions: GameSession[];
    levels: Level[];
    exportedAt: string;
  } {
    return {
      sessions: this.getAllSessions(),
      levels: this.getLevels(),
      exportedAt: new Date().toISOString(),
    };
  }

  static importData(data: {
    sessions?: GameSession[];
    levels?: Level[];
  }): { importedSessions: number; importedLevels: number } {
    let importedSessions = 0;
    let importedLevels = 0;

    if (data.sessions && Array.isArray(data.sessions)) {
      const existing = this.getAllSessions();
      const merged = [...existing];
      
      data.sessions.forEach((session) => {
        const existingIndex = merged.findIndex((s) => s.id === session.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = session;
        } else {
          merged.unshift(session);
          importedSessions++;
        }
      });
      
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(merged));
    }

    if (data.levels && Array.isArray(data.levels)) {
      const existing = this.getLevels();
      const merged = [...existing];
      
      data.levels.forEach((level) => {
        const existingIndex = merged.findIndex((l) => l.id === level.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = level;
        } else {
          merged.push(level);
          importedLevels++;
        }
      });
      
      localStorage.setItem(STORAGE_KEYS.LEVELS, JSON.stringify(merged));
    }

    return { importedSessions, importedLevels };
  }

  static searchSessions(query: string): GameSession[] {
    const sessions = this.getAllSessions();
    const lowerQuery = query.toLowerCase();
    
    return sessions.filter((s) => 
      s.playerName.toLowerCase().includes(lowerQuery) ||
      (s.levelName?.toLowerCase() || '').includes(lowerQuery) ||
      s.id.toLowerCase().includes(lowerQuery)
    );
  }

  static getRecentSessions(limit: number = 10): GameSession[] {
    return this.getAllSessions().slice(0, limit);
  }

  static getSessionStats(): {
    total: number;
    completed: number;
    inProgress: number;
    interrupted: number;
    avgScore: number;
  } {
    const sessions = this.getAllSessions();
    const completed = sessions.filter((s) => s.status === 'completed');
    const inProgress = sessions.filter((s) => s.status === 'playing' || s.status === 'paused');
    const interrupted = sessions.filter((s) => s.status === 'interrupted');
    
    const scores = completed
      .map((s) => s.scoreResult?.totalScore || 0)
      .filter((s) => s > 0);
    
    const avgScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100
      : 0;

    return {
      total: sessions.length,
      completed: completed.length,
      inProgress: inProgress.length,
      interrupted: interrupted.length,
      avgScore,
    };
  }
}
