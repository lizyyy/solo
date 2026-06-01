import type { Session, SessionStep, TeacherNote, SupplementNote } from "@/types";

const KEYS = {
  sessions: "jazz-chord-sessions",
  steps: "jazz-chord-steps",
  notes: "jazz-chord-notes",
  supplements: "jazz-chord-supplements",
};

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(KEYS.sessions);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: Session[]): void {
  localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
}

export function loadSteps(sessionId: string): SessionStep[] {
  try {
    const raw = localStorage.getItem(`${KEYS.steps}-${sessionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSteps(sessionId: string, steps: SessionStep[]): void {
  localStorage.setItem(`${KEYS.steps}-${sessionId}`, JSON.stringify(steps));
}

export function loadNotes(sessionId: string): TeacherNote[] {
  try {
    const raw = localStorage.getItem(`${KEYS.notes}-${sessionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNotes(sessionId: string, notes: TeacherNote[]): void {
  localStorage.setItem(`${KEYS.notes}-${sessionId}`, JSON.stringify(notes));
}

export function loadSupplements(sessionId: string): SupplementNote[] {
  try {
    const raw = localStorage.getItem(`${KEYS.supplements}-${sessionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSupplements(sessionId: string, supplements: SupplementNote[]): void {
  localStorage.setItem(`${KEYS.supplements}-${sessionId}`, JSON.stringify(supplements));
}
