import { useState, useEffect, useCallback } from 'react';
import type { StoredSession } from '../types';
import { useSessionStore } from '../stores/useSessionStore';
import { useMaterialStore } from '../stores/useMaterialStore';
import { useComputationStore } from '../stores/useComputationStore';
import { useAuditStore } from '../stores/useAuditStore';
import { auditLogger } from '../services/auditLogger';
import { persistenceService } from '../services/persistence';

interface RecoveryState {
  showDialog: boolean;
  pendingSession: StoredSession | null;
  isChecking: boolean;
  recoverableSessions: StoredSession[];
  pendingCount: number;
}

export function useProgressRecovery() {
  const [state, setState] = useState<RecoveryState>({
    showDialog: false,
    pendingSession: null,
    isChecking: true,
    recoverableSessions: [],
    pendingCount: 0,
  });

  const {
    currentSession,
    loadFullSession,
    saveFullSession,
    getCurrentProgress,
    setSessionStatus,
    loadSessions,
    sessions,
  } = useSessionStore();
  const { materials, loadMaterials, clearMaterials } = useMaterialStore();
  const { steps, loadSteps, clearSteps, expandedSteps } = useComputationStore();
  const { logs, loadLogs, clearLogs, loadPendingSuspendedTasks, suspendedTasks } = useAuditStore();

  const checkForPendingProgress = useCallback(async () => {
    setState((prev) => ({ ...prev, isChecking: true }));
    try {
      await loadSessions();
      await loadPendingSuspendedTasks();
      
      const progress = await getCurrentProgress();
      if (progress && !currentSession) {
        const data = await persistenceService.getFullSession(progress.sessionId);
        if (data && data.session.status !== 'completed') {
          setState({
            showDialog: true,
            pendingSession: data,
            isChecking: false,
            recoverableSessions: [data],
            pendingCount: suspendedTasks.filter(t => t.status === 'pending').length,
          });
          return;
        }
      }
      
      const sessionPromises = sessions
        .filter(s => s.status !== 'completed')
        .map(s => persistenceService.getFullSession(s.id));
      
      const loadedSessions = await Promise.all(sessionPromises);
      const validSessions = loadedSessions.filter((s): s is StoredSession => s !== null);
      
      setState((prev) => ({ 
        ...prev, 
        isChecking: false,
        recoverableSessions: validSessions,
        pendingCount: suspendedTasks.filter(t => t.status === 'pending').length,
      }));
    } catch (error) {
      console.error('Failed to check progress:', error);
      setState((prev) => ({ ...prev, isChecking: false }));
    }
  }, [currentSession, getCurrentProgress, loadSessions, sessions, loadPendingSuspendedTasks, suspendedTasks]);

  useEffect(() => {
    checkForPendingProgress();
  }, [checkForPendingProgress]);

  const recoverSession = useCallback(async (sessionId?: string) => {
    const targetSession = sessionId 
      ? state.recoverableSessions.find(s => s.session.id === sessionId)
      : state.pendingSession;
      
    if (!targetSession) return;

    const { session, materials: savedMaterials, computationSteps, auditLogs, suspendedTasks: savedSuspendedTasks } =
      targetSession;

    await saveFullSession({
      session: {
        ...session,
        status: 'pending',
      },
      materials: savedMaterials,
      computationSteps,
      auditLogs,
      suspendedTasks: savedSuspendedTasks,
    });

    await loadMaterials(session.id);
    await loadSteps(session.id);
    await loadLogs(session.id);
    await setSessionStatus('pending');

    const resumeLog = auditLogger.logResumeSession(session.id);
    await persistenceService.saveAuditLog(resumeLog);

    setState({
      showDialog: false,
      pendingSession: null,
      isChecking: false,
      recoverableSessions: [],
      pendingCount: 0,
    });
  }, [state.pendingSession, state.recoverableSessions, saveFullSession, loadMaterials, loadSteps, loadLogs, setSessionStatus]);

  const discardRecovery = useCallback(() => {
    setState({
      showDialog: false,
      pendingSession: null,
      isChecking: false,
      recoverableSessions: [],
      pendingCount: 0,
    });
  }, []);

  const loadSessionById = useCallback(
    async (sessionId: string) => {
      const data = await loadFullSession(sessionId);
      if (data) {
        clearMaterials();
        clearSteps();
        clearLogs();

        await loadMaterials(sessionId);
        await loadSteps(sessionId);
        await loadLogs(sessionId);
      }
      return data;
    },
    [loadFullSession, loadMaterials, loadSteps, loadLogs, clearMaterials, clearSteps, clearLogs]
  );

  return {
    ...state,
    showRecoveryDialog: state.showDialog,
    dismissRecovery: discardRecovery,
    recoverSession,
    discardRecovery,
    loadSessionById,
    checkForPendingProgress,
  };
}
