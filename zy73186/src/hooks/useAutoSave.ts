import { useEffect, useRef, useCallback } from 'react';
import type { StoredSession } from '../types';
import { useSessionStore } from '../stores/useSessionStore';
import { useMaterialStore } from '../stores/useMaterialStore';
import { useComputationStore } from '../stores/useComputationStore';
import { useAuditStore } from '../stores/useAuditStore';
import { persistenceService } from '../services/persistence';

const AUTOSAVE_INTERVAL = 30000;

export function useAutoSave(sessionId?: string) {
  const { currentSession, saveFullSession } = useSessionStore();
  const { materials } = useMaterialStore();
  const { steps, expandedSteps } = useComputationStore();
  const { logs, suspendedTasks } = useAuditStore();

  const lastSaveTime = useRef<number>(0);
  const isSaving = useRef<boolean>(false);

  const performSave = useCallback(async () => {
    if (!currentSession || isSaving.current) return;
    if (sessionId && currentSession.id !== sessionId) return;

    isSaving.current = true;
    try {
      const updatedSession = {
        ...currentSession,
        progress: {
          ...currentSession.progress,
          expandedSteps,
        },
        updatedAt: Date.now(),
      };

      const data: StoredSession = {
        session: updatedSession,
        materials,
        computationSteps: steps,
        auditLogs: logs,
        suspendedTasks,
      };

      await saveFullSession(data);
      lastSaveTime.current = Date.now();
    } catch (error) {
      console.error('Auto save failed:', error);
    } finally {
      isSaving.current = false;
    }
  }, [currentSession, materials, steps, expandedSteps, logs, suspendedTasks, saveFullSession, sessionId]);

  const saveNow = useCallback(async () => {
    await performSave();
  }, [performSave]);

  const triggerSave = useCallback(async () => {
    await performSave();
  }, [performSave]);

  useEffect(() => {
    if (!currentSession) return;

    const intervalId = setInterval(() => {
      performSave();
    }, AUTOSAVE_INTERVAL);

    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (currentSession) {
        await performSave();
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentSession, performSave]);

  useEffect(() => {
    if (!currentSession) return;

    const now = Date.now();
    if (now - lastSaveTime.current > 5000) {
      performSave();
    }
  }, [currentSession?.id, steps.length, materials.length, logs.length, performSave]);

  return {
    saveNow,
    triggerSave,
    lastSaveTime: lastSaveTime.current,
    isSaving: isSaving.current,
  };
}
