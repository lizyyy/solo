import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  GateSession,
  GateStepResult,
  GateStudentOperation,
  GateJudgment
} from '@/types/gate';
import {
  GATE_STANDARD_STEPS,
  DEFAULT_JUDGMENT_CONFIG
} from '@/types/gate';
import { generateId } from '@/utils/time';
import { generateJudgment, detectStepSkipped, detectViewReset, detectDragLost } from '@/utils/gateJudgment';
import { saveSession, getAllSessions } from '@/utils/storage';
import { useTimelineStore } from './timeline';

export const useGateStore = defineStore('gate', () => {
  const sessions = ref<GateSession[]>([]);
  const currentSessionId = ref<string | null>(null);
  const isTeachingView = ref(false);
  const isLoading = ref(false);
  const isProcessing = ref(false);

  const currentSession = computed(() => {
    if (!currentSessionId.value) return null;
    return sessions.value.find(s => s.id === currentSessionId.value) || null;
  });

  const currentSteps = computed(() => {
    return currentSession.value?.steps || [];
  });

  const totalScore = computed(() => {
    if (!currentSession.value) return { score: 0, max: 0, percent: 0 };
    const score = currentSession.value.totalScore;
    const max = currentSession.value.maxScore;
    return {
      score,
      max,
      percent: max > 0 ? Math.round(score / max * 100) : 0
    };
  });

  const pendingSteps = computed(() => {
    return currentSteps.value.filter(s => s.judgment?.result === 'pending');
  });

  const failedSteps = computed(() => {
    return currentSteps.value.filter(s => s.judgment?.result === 'fail');
  });

  async function loadSessions() {
    isLoading.value = true;
    try {
      sessions.value = await getAllSessions();
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      isLoading.value = false;
    }
  }

  function createSession(studentName: string): GateSession {
    const steps: GateStepResult[] = GATE_STANDARD_STEPS.map(step => ({
      step,
      status: 'pending',
      events: []
    }));

    const session: GateSession = {
      id: generateId(),
      studentName,
      startTime: Date.now(),
      steps,
      totalScore: 0,
      maxScore: GATE_STANDARD_STEPS.reduce((sum, s) => sum + s.maxScore, 0),
      isTeachingView: false,
      abnormalCount: 0,
      pendingCount: GATE_STANDARD_STEPS.length
    };

    sessions.value.push(session);
    currentSessionId.value = session.id;
    return session;
  }

  function selectSession(id: string) {
    currentSessionId.value = id;
    const session = sessions.value.find(s => s.id === id);
    if (session) {
      isTeachingView.value = session.isTeachingView;
    }
  }

  function addOperation(stepId: string, operation: GateStudentOperation) {
    if (!currentSession.value) return;

    const stepIndex = currentSession.value.steps.findIndex(s => s.step.id === stepId);
    if (stepIndex === -1) return;

    currentSession.value.steps[stepIndex].operation = operation;
    currentSession.value.steps[stepIndex].status = 'in_progress';

    const judgment = generateJudgment(
      currentSession.value.steps[stepIndex].step,
      operation,
      DEFAULT_JUDGMENT_CONFIG
    );
    judgment.eventId = `gate-${currentSession.value.id}-${stepId}`;
    judgment.stepId = stepId;

    currentSession.value.steps[stepIndex].judgment = judgment;
    currentSession.value.steps[stepIndex].status = judgment.result === 'pending' ? 'error' : 'completed';

    const timelineStore = useTimelineStore();
    const eventTimestamp = operation.timestamp;

    timelineStore.addEvent({
      timestamp: eventTimestamp,
      type: 'operation',
      title: `${currentSession.value.steps[stepIndex].step.name} - 操作记录`,
      description: operation.rawData?.description || '学生操作记录',
      status: judgment.result === 'pending' ? 'pending' : 'normal',
      source: 'auto',
      operator: currentSession.value.studentName,
      metadata: {
        stepId,
        sessionId: currentSession.value.id,
        operation
      },
      scoreItem: judgment.score !== undefined ? {
        id: `score-${stepId}`,
        name: currentSession.value.steps[stepIndex].step.name,
        maxScore: judgment.maxScore,
        score: judgment.score,
        criteria: currentSession.value.steps[stepIndex].step.criteria.join('; ')
      } : undefined,
      evidenceLinks: []
    });

    detectAndMarkAbnormalities(stepIndex, operation);

    recalculateSession();
    saveCurrentSession();
  }

  function detectAndMarkAbnormalities(stepIndex: number, operation: GateStudentOperation) {
    if (!currentSession.value) return;

    const timelineStore = useTimelineStore();
    const step = currentSession.value.steps[stepIndex];

    const initialView = { cameraX: 0, cameraY: 0, cameraZ: 100, rotation: 0 };

    if (detectDragLost(operation)) {
      timelineStore.addEvent({
        timestamp: operation.timestamp,
        type: 'abnormal',
        title: `${step.step.name} - 拖拽状态丢失`,
        description: '检测到拖拽开始但没有正常结束，或结束位置异常',
        status: 'pending',
        source: 'auto',
        operator: currentSession.value.studentName,
        abnormalMark: {
          id: generateId(),
          eventId: '',
          type: 'drag_lost',
          description: '拖拽事件不完整，状态可能丢失',
          confirmed: false,
          originalEvidence: operation.rawData
        },
        metadata: { stepId: step.step.id, sessionId: currentSession.value.id }
      }).then(event => {
        if (event.abnormalMark) {
          event.abnormalMark.eventId = event.id;
          timelineStore.updateEvent(event.id, { abnormalMark: event.abnormalMark });
        }
      });
      currentSession.value.abnormalCount++;
      step.status = 'error';
    }

    if (detectViewReset(operation, initialView)) {
      timelineStore.addEvent({
        timestamp: operation.timestamp + 100,
        type: 'abnormal',
        title: `${step.step.name} - 视角重置`,
        description: '检测到视角参数在短时间内跳回初始值',
        status: 'pending',
        source: 'auto',
        operator: currentSession.value.studentName,
        abnormalMark: {
          id: generateId(),
          eventId: '',
          type: 'view_reset',
          description: '视角被意外重置，请确认操作有效性',
          confirmed: false,
          originalEvidence: operation.parameters
        },
        metadata: { stepId: step.step.id, sessionId: currentSession.value.id }
      }).then(event => {
        if (event.abnormalMark) {
          event.abnormalMark.eventId = event.id;
          timelineStore.updateEvent(event.id, { abnormalMark: event.abnormalMark });
        }
      });
      currentSession.value.abnormalCount++;
      step.status = 'error';
    }
  }

  function checkSkippedSteps(operations: GateStudentOperation[]) {
    if (!currentSession.value) return;

    const skippedStepIds = detectStepSkipped(GATE_STANDARD_STEPS, operations);
    const timelineStore = useTimelineStore();

    skippedStepIds.forEach(stepId => {
      const step = currentSession.value!.steps.find(s => s.step.id === stepId);
      if (step) {
        step.status = 'skipped';
        timelineStore.addEvent({
          timestamp: Date.now(),
          type: 'abnormal',
          title: `${step.step.name} - 步骤被跳过`,
          description: '标准步骤序列中缺失该步骤的操作记录',
          status: 'pending',
          source: 'auto',
          operator: currentSession.value!.studentName,
          abnormalMark: {
            id: generateId(),
            eventId: '',
            type: 'step_skipped',
            description: '该步骤未执行，已标记为待确认',
            confirmed: false
          },
          metadata: { stepId, sessionId: currentSession.value!.id }
        }).then(event => {
          if (event.abnormalMark) {
            event.abnormalMark.eventId = event.id;
            timelineStore.updateEvent(event.id, { abnormalMark: event.abnormalMark });
          }
        });
        currentSession.value!.abnormalCount++;
      }
    });

    recalculateSession();
    saveCurrentSession();
  }

  function updateJudgment(stepId: string, updates: Partial<GateJudgment>) {
    if (!currentSession.value) return;

    const stepIndex = currentSession.value.steps.findIndex(s => s.step.id === stepId);
    if (stepIndex === -1 || !currentSession.value.steps[stepIndex].judgment) return;

    currentSession.value.steps[stepIndex].judgment = {
      ...currentSession.value.steps[stepIndex].judgment!,
      ...updates,
      isFinal: true
    };

    if (updates.result) {
      currentSession.value.steps[stepIndex].status = updates.result === 'pending' ? 'error' : 'completed';
    }

    recalculateSession();
    saveCurrentSession();
  }

  function recalculateSession() {
    if (!currentSession.value) return;

    let totalScore = 0;
    let pendingCount = 0;

    currentSession.value.steps.forEach(step => {
      if (step.judgment) {
        totalScore += step.judgment.score;
        if (step.judgment.result === 'pending') {
          pendingCount++;
        }
      } else {
        pendingCount++;
      }
    });

    currentSession.value.totalScore = totalScore;
    currentSession.value.pendingCount = pendingCount;
  }

  function toggleTeachingView() {
    isTeachingView.value = !isTeachingView.value;
    if (currentSession.value) {
      currentSession.value.isTeachingView = isTeachingView.value;
      saveCurrentSession();
    }
  }

  function completeSession() {
    if (!currentSession.value) return;
    currentSession.value.endTime = Date.now();
    saveCurrentSession();
  }

  async function saveCurrentSession() {
    if (currentSession.value) {
      await saveSession(currentSession.value);
    }
  }

  function createNewSession(): GateSession {
    const steps: GateStepResult[] = GATE_STANDARD_STEPS.map(step => ({
      step,
      status: 'pending',
      events: []
    }));

    return {
      id: generateId(),
      studentName: '未命名学员',
      startTime: Date.now(),
      steps,
      totalScore: 0,
      maxScore: GATE_STANDARD_STEPS.reduce((sum, s) => sum + s.maxScore, 0),
      isTeachingView: false,
      abnormalCount: 0,
      pendingCount: GATE_STANDARD_STEPS.length
    };
  }

  async function loadLatestOrCreate() {
    isLoading.value = true;
    try {
      sessions.value = await getAllSessions();
      if (sessions.value.length > 0) {
        const latest = sessions.value.reduce((a, b) => (a.startTime > b.startTime ? a : b));
        currentSessionId.value = latest.id;
        isTeachingView.value = latest.isTeachingView || false;
      } else {
        const newSession = createSession('默认学员');
        await persistSession(newSession);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      const newSession = createSession('默认学员');
      await persistSession(newSession);
    } finally {
      isLoading.value = false;
    }
  }

  async function persistSession(session: GateSession) {
    const index = sessions.value.findIndex(s => s.id === session.id);
    if (index === -1) {
      sessions.value.push(session);
    } else {
      sessions.value[index] = session;
    }
    await saveSession(session);
  }

  function setSession(session: GateSession) {
    const index = sessions.value.findIndex(s => s.id === session.id);
    if (index === -1) {
      sessions.value.push(session);
    } else {
      sessions.value[index] = session;
    }
    currentSessionId.value = session.id;
    isTeachingView.value = session.isTeachingView || false;
  }

  async function runAutoJudgment() {
    if (!currentSession.value) return;

    isProcessing.value = true;
    try {
      const operations: GateStudentOperation[] = [];

      for (let i = 0; i < currentSession.value.steps.length; i++) {
        const step = currentSession.value.steps[i];
        if (step.operation && !step.judgment) {
          const op = step.operation;
          const studentOp: GateStudentOperation = {
            id: generateId(),
            stepId: step.step.id,
            timestamp: op.timestamp,
            duration: op.duration,
            parameters: op.parameters,
            rawData: op
          };
          operations.push(studentOp);

          const judgment = generateJudgment(step.step, studentOp, DEFAULT_JUDGMENT_CONFIG);
          judgment.eventId = `gate-${currentSession.value.id}-${step.step.id}`;
          judgment.stepId = step.step.id;

          currentSession.value.steps[i].judgment = judgment;
          currentSession.value.steps[i].status = judgment.result === 'pending' ? 'error' : 'completed';

          detectAndMarkAbnormalities(i, studentOp);
        }
      }

      checkSkippedSteps(operations);
      recalculateSession();
      await saveCurrentSession();
    } finally {
      isProcessing.value = false;
    }
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    currentSteps,
    totalScore,
    pendingSteps,
    failedSteps,
    isTeachingView,
    isLoading,
    isProcessing,
    loadSessions,
    loadLatestOrCreate,
    createSession,
    createNewSession,
    selectSession,
    setSession,
    addOperation,
    updateJudgment,
    checkSkippedSteps,
    toggleTeachingView,
    completeSession,
    persistSession,
    runAutoJudgment
  };
});
