import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import type { Workspace, Action } from '../types';
import { workspaceReducer, createInitialWorkspace } from './reducer';
import { loadWorkspaceFromStorage, saveWorkspaceToStorage } from './persistence';
import { detectConflicts, detectGaps, calculateStatistics } from '../utils/analyzer';
import type { Statistics, Conflict, Gap } from '../types';

interface WorkspaceContextType {
  workspace: Workspace;
  dispatch: React.Dispatch<Action>;
  conflicts: Conflict[];
  gaps: Gap[];
  statistics: Statistics;
  analyzeData: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, dispatch] = useReducer(workspaceReducer, undefined, () => {
    const saved = loadWorkspaceFromStorage();
    return saved || createInitialWorkspace();
  });

  useEffect(() => {
    saveWorkspaceToStorage(workspace);
  }, [workspace]);

  const conflicts = useMemo(() => {
    const detected = detectConflicts(workspace.clues);
    const resolvedIds = new Set(
      workspace.conflicts.filter(c => c.resolved).map(c => c.id)
    );
    
    return detected.map(d => ({
      ...d,
      resolved: workspace.conflicts.find(
        c => c.involvedClueIds.sort().join(',') === d.involvedClueIds.sort().join(',')
      )?.resolved || false,
      resolvedNotes: workspace.conflicts.find(
        c => c.involvedClueIds.sort().join(',') === d.involvedClueIds.sort().join(',')
      )?.resolvedNotes,
    }));
  }, [workspace.clues, workspace.conflicts]);

  const gaps = useMemo(() => {
    return detectGaps(workspace.clues, workspace.players);
  }, [workspace.clues, workspace.players]);

  const statistics = useMemo(() => {
    return calculateStatistics(
      workspace.clues,
      workspace.players,
      conflicts,
      gaps
    );
  }, [workspace.clues, workspace.players, conflicts, gaps]);

  const analyzeData = () => {
    dispatch({ type: 'SET_WORKSPACE', payload: {
      ...workspace,
      conflicts,
      gaps,
    }});
  };

  return (
    <WorkspaceContext.Provider value={{
      workspace,
      dispatch,
      conflicts,
      gaps,
      statistics,
      analyzeData,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
