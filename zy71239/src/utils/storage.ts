import { GameSession } from '../game/types';

const STORAGE_KEY = 'security_queue_game_sessions';
const MAX_SESSIONS = 10;

export const saveSession = (session: GameSession): void => {
  try {
    const sessions = getSessions();
    sessions.unshift(session);
    
    if (sessions.length > MAX_SESSIONS) {
      sessions.splice(MAX_SESSIONS);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
};

export const getSessions = (): GameSession[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get sessions:', error);
    return [];
  }
};

export const getSession = (sessionId: string): GameSession | null => {
  try {
    const sessions = getSessions();
    return sessions.find(s => s.id === sessionId) || null;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
};

export const updateSessionReview = (sessionId: string, eventId: string, note: string): boolean => {
  try {
    const sessions = getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) return false;
    
    const eventIndex = sessions[sessionIndex].events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return false;
    
    sessions[sessionIndex].events[eventIndex].reviewNote = note;
    sessions[sessionIndex].events[eventIndex].reviewed = true;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch (error) {
    console.error('Failed to update review:', error);
    return false;
  }
};

export const clearSessions = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
