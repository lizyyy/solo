import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore } from '../store';
import type { BatchTask, FailedItem } from '../../shared/types';

type TaskApiFn = (taskId: string) => Promise<{ success: boolean; data?: BatchTask; error?: string }>;

export function useBatchTask(
  ...args:
    | [taskApi: TaskApiFn]
    | [taskId: string | null, taskApi: TaskApiFn]
    | [taskId: string | null, taskApi: TaskApiFn, onComplete?: (task: BatchTask) => void]
    | [
        taskId: string | null,
        taskApi: TaskApiFn,
        onComplete?: (task: BatchTask) => void,
        onError?: (error: string) => void
      ]
) {
  const arg1 = args[0];
  const arg2 = args.length > 1 ? args[1] : undefined;
  const arg3 = args.length > 2 ? args[2] : undefined;
  const arg4 = args.length > 3 ? args[3] : undefined;

  const updateBatchTask = useAppStore((state) => state.updateBatchTask);
  const removeBatchTask = useAppStore((state) => state.removeBatchTask);
  const addNotification = useAppStore((state) => state.addNotification);
  const batchTasks = useAppStore((state) => state.batchTasks);

  const [isPolling, setIsPolling] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const isActiveRef = useRef(false);
  const pollCountRef = useRef(0);
  const taskApiRef = useRef<TaskApiFn>(() => Promise.resolve({ success: false }));
  const onCompleteRef = useRef<((task: BatchTask) => void) | undefined>();
  const onErrorRef = useRef<((error: string) => void) | undefined>();
  const initialTaskIdRef = useRef<string | null>(null);

  const isLegacyMode = typeof arg1 === 'function';
  const taskApi = isLegacyMode ? (arg1 as TaskApiFn) : (arg2 as TaskApiFn);
  const initialTaskId = isLegacyMode ? null : (arg1 as string | null);
  const onComplete = arg3;
  const onError = arg4;

  useEffect(() => {
    taskApiRef.current = taskApi;
  }, [taskApi]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    initialTaskIdRef.current = initialTaskId;
  }, [initialTaskId]);

  const effectiveTaskId = isLegacyMode ? currentTaskId : initialTaskId;

  const currentTask = effectiveTaskId ? batchTasks.get(effectiveTaskId) : null;

  const pollTask = useCallback(async (taskId: string) => {
    const response = await taskApiRef.current(taskId);
    if (response.success && response.data) {
      updateBatchTask(response.data);

      if (response.data.status === 'completed' || response.data.status === 'failed' || response.data.status === 'partial') {
        if (onCompleteRef.current) {
          onCompleteRef.current(response.data);
        }

        if (response.data.status === 'completed') {
          addNotification({
            type: 'success',
            title: '任务完成',
            message: '操作已成功完成',
            description: '',
          });
        } else if (response.data.status === 'partial') {
          addNotification({
            type: 'warning',
            title: '任务部分完成',
            message: `成功 ${response.data.successCount}，失败 ${response.data.failedCount}`,
            description: '',
          });
        } else if (response.data.status === 'failed') {
          addNotification({
            type: 'error',
            title: '任务失败',
            message: response.data.failedItems?.[0]?.errorMessage || '操作失败',
            description: '',
          });
          if (onErrorRef.current) {
            onErrorRef.current(response.data.failedItems?.[0]?.errorMessage || '操作失败');
          }
        }
        return true;
      }
    } else if (response.error) {
      addNotification({
        type: 'error',
        title: '查询任务状态失败',
        message: response.error,
        description: '',
      });
      if (onErrorRef.current) {
        onErrorRef.current(response.error);
      }
      return true;
    }
    return false;
  }, [updateBatchTask, addNotification]);

  const startPollingLegacy = useCallback((taskId: string) => {
    if (isPolling) return;

    setCurrentTaskId(taskId);
    setIsPolling(true);
    isActiveRef.current = true;
    pollCountRef.current = 0;
    const maxPolls = 120;

    const poll = async () => {
      if (!isActiveRef.current || pollCountRef.current >= maxPolls) {
        setIsPolling(false);
        return;
      }

      pollCountRef.current++;
      const shouldStop = await pollTask(taskId);

      if (shouldStop) {
        setIsPolling(false);
        isActiveRef.current = false;
        return;
      }

      if (isActiveRef.current) {
        setTimeout(poll, 2000);
      }
    };

    poll();
  }, [isPolling, pollTask]);

  const startPollingAuto = useCallback(() => {
    const taskId = initialTaskIdRef.current;
    if (isPolling || !taskId) return;

    setIsPolling(true);
    isActiveRef.current = true;
    pollCountRef.current = 0;
    const maxPolls = 120;

    const poll = async () => {
      const currentTaskId = initialTaskIdRef.current;
      if (!isActiveRef.current || pollCountRef.current >= maxPolls || !currentTaskId) {
        setIsPolling(false);
        return;
      }

      pollCountRef.current++;
      const shouldStop = await pollTask(currentTaskId);

      if (shouldStop) {
        setIsPolling(false);
        isActiveRef.current = false;
        return;
      }

      if (isActiveRef.current) {
        setTimeout(poll, 2000);
      }
    };

    poll();
  }, [isPolling, pollTask]);

  const stopPolling = useCallback(() => {
    isActiveRef.current = false;
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!isLegacyMode && initialTaskId) {
      startPollingAuto();
    }

    return () => {
      stopPolling();
    };
  }, [isLegacyMode, initialTaskId]);

  useEffect(() => {
    if (currentTask && ['completed', 'failed', 'partial'].includes(currentTask.status)) {
      const timer = setTimeout(() => {
        removeBatchTask(currentTask.id);
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [currentTask, removeBatchTask]);

  return {
    task: currentTask,
    taskId: currentTask?.id || effectiveTaskId,
    status: currentTask?.status || 'pending',
    failedItems: (currentTask?.failedItems || []) as FailedItem[],
    isRunning: currentTask?.status === 'running',
    isCompleted: currentTask?.status === 'completed',
    isFailed: currentTask?.status === 'failed',
    progress: currentTask?.progress || 0,
    startPolling: isLegacyMode ? startPollingLegacy : startPollingAuto,
    stopPolling,
  };
}
