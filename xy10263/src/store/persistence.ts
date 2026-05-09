import type { Workspace } from '../types';
import { calculateChecksum } from '../utils/hash';

const STORAGE_KEY = 'script_kill_review_workspace_v1';

export function loadWorkspaceFromStorage(): Workspace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    
    const workspace = JSON.parse(raw) as Workspace;
    
    if (!workspace || !workspace.id || !Array.isArray(workspace.players)) {
      console.warn('Invalid workspace data in storage');
      return null;
    }
    
    return workspace;
  } catch (error) {
    console.error('Failed to load workspace from storage:', error);
    return null;
  }
}

export function saveWorkspaceToStorage(workspace: Workspace): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch (error) {
    console.error('Failed to save workspace to storage:', error);
  }
}

export function clearWorkspaceFromStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function verifyDataIntegrity(workspace: Workspace): boolean {
  try {
    const currentChecksum = calculateChecksum(
      workspace.players,
      workspace.clues,
      workspace.conflicts,
      workspace.gaps
    );
    
    const saved = loadWorkspaceFromStorage();
    if (!saved) return true;
    
    const savedChecksum = calculateChecksum(
      saved.players,
      saved.clues,
      saved.conflicts,
      saved.gaps
    );
    
    return currentChecksum === savedChecksum;
  } catch (error) {
    console.error('Data integrity check failed:', error);
    return false;
  }
}
