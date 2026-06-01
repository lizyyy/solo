import { create } from "zustand";
import type { Session, SessionStep, GameStatus, FeedbackInfo } from "@/types";
import { getLevelsByGroup } from "@/data/levels";
import { loadSessions, saveSessions, loadSteps, saveSteps } from "@/utils/storage";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface GameStore {
  gameStatus: GameStatus;
  currentGroupId: string | null;
  currentLevelIndex: number;
  currentSession: Session | null;
  sessionSteps: SessionStep[];
  timer: number;
  levelStartTime: number;
  feedback: FeedbackInfo | null;
  score: number;
  combo: number;
  maxCombo: number;
  timerInterval: ReturnType<typeof setInterval> | null;

  startGame: (groupId: string) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: () => void;
  selectOption: (optionId: string) => void;
  tick: () => void;
  clearFeedback: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameStatus: "idle",
  currentGroupId: null,
  currentLevelIndex: 0,
  currentSession: null,
  sessionSteps: [],
  timer: 0,
  levelStartTime: 0,
  feedback: null,
  score: 0,
  combo: 0,
  maxCombo: 0,
  timerInterval: null,

  startGame: (groupId: string) => {
    const levels = getLevelsByGroup(groupId);
    if (levels.length === 0) return;

    const session: Session = {
      id: genId(),
      groupId,
      startTime: Date.now(),
      endTime: null,
      score: 0,
      combo: 0,
      maxCombo: 0,
      status: "playing",
    };

    const firstLevel = levels[0];
    const interval = setInterval(() => {
      get().tick();
    }, 100);

    set({
      gameStatus: "playing",
      currentGroupId: groupId,
      currentLevelIndex: 0,
      currentSession: session,
      sessionSteps: [],
      timer: firstLevel.timeLimit * 10,
      levelStartTime: Date.now(),
      feedback: null,
      score: 0,
      combo: 0,
      maxCombo: 0,
      timerInterval: interval,
    });
  },

  pauseGame: () => {
    const { gameStatus, timerInterval } = get();
    if (gameStatus !== "playing") return;
    if (timerInterval) clearInterval(timerInterval);

    set((state) => {
      if (state.currentSession) {
        state.currentSession.status = "paused";
      }
      return {
        gameStatus: "paused",
        timerInterval: null,
        currentSession: state.currentSession,
      };
    });
  },

  resumeGame: () => {
    const { gameStatus } = get();
    if (gameStatus !== "paused") return;

    const interval = setInterval(() => {
      get().tick();
    }, 100);

    set((state) => {
      if (state.currentSession) {
        state.currentSession.status = "playing";
      }
      return {
        gameStatus: "playing",
        timerInterval: interval,
        levelStartTime: Date.now() - ((getLevelsByGroup(state.currentGroupId!)[state.currentLevelIndex]?.timeLimit ?? 0) * 1000 - state.timer * 100),
        currentSession: state.currentSession,
      };
    });
  },

  restartGame: () => {
    const { currentGroupId, timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);

    if (currentGroupId) {
      get().startGame(currentGroupId);
    } else {
      set({ gameStatus: "idle", currentGroupId: null, currentLevelIndex: 0, currentSession: null, sessionSteps: [], timer: 0, feedback: null, score: 0, combo: 0, maxCombo: 0, timerInterval: null });
    }
  },

  endGame: () => {
    const { timerInterval, currentSession, score, maxCombo, sessionSteps } = get();
    if (timerInterval) clearInterval(timerInterval);

    if (currentSession) {
      const completed: Session = {
        ...currentSession,
        endTime: Date.now(),
        score,
        maxCombo,
        status: "completed",
      };

      const allSessions = loadSessions();
      allSessions.push(completed);
      saveSessions(allSessions);
      saveSteps(completed.id, sessionSteps);

      set({ currentSession: completed, gameStatus: "completed", timerInterval: null });
    }
  },

  selectOption: (optionId: string) => {
    const { currentGroupId, currentLevelIndex, currentSession, sessionSteps, score, combo, maxCombo, timer, levelStartTime } = get();
    if (!currentGroupId || !currentSession) return;

    const levels = getLevelsByGroup(currentGroupId);
    const level = levels[currentLevelIndex];
    if (!level) return;

    const option = level.options.find((o) => o.id === optionId);
    if (!option) return;

    const timeSpent = (Date.now() - levelStartTime) / 1000;
    const isCorrect = option.isCorrect;
    const timeThreshold = level.timeLimit * 0.8;

    let failType: "rule_misunderstood" | "too_slow" | null = null;
    if (!isCorrect) {
      failType = "rule_misunderstood";
    } else if (timeSpent > timeThreshold) {
      failType = "too_slow";
    }

    const step: SessionStep = {
      id: genId(),
      sessionId: currentSession.id,
      levelId: level.id,
      stepOrder: sessionSteps.length,
      selectedOption: optionId,
      correct: isCorrect,
      timeSpent: Math.round(timeSpent * 100) / 100,
      failType,
      timestamp: Date.now(),
    };

    let newScore = score;
    let newCombo = combo;
    let newMaxCombo = maxCombo;
    let feedback: FeedbackInfo;

    if (isCorrect) {
      newCombo++;
      if (newCombo > newMaxCombo) newMaxCombo = newCombo;
      const baseScore = 100;
      const timeBonus = timeSpent < level.timeLimit * 0.5 ? 50 : 0;
      const comboMultiplier = newCombo >= 2 ? 1.5 : 1;
      newScore += Math.round((baseScore + timeBonus) * comboMultiplier);

      feedback = {
        correct: true,
        failType: failType ?? null,
        message: failType === "too_slow" ? "正确，但有点慢！" : "完美！",
        detail: failType === "too_slow"
          ? `答对了但耗时 ${timeSpent.toFixed(1)}s，超过 ${timeThreshold}s 的安全线，下次再快一点！`
          : `${level.targetChord} = ${level.targetNotes.join(" - ")}`,
      };
    } else {
      newCombo = 0;
      feedback = {
        correct: false,
        failType: "rule_misunderstood",
        message: "选错了！",
        detail: `${level.targetChord} 的正确构成音是 ${level.targetNotes.join(" - ")}，你选的 ${option.label} ${option.notes.length < level.targetNotes.length ? "音不够" : option.notes.length > level.targetNotes.length ? "音多了" : "音程关系不对"}`,
      };
    }

    const newSteps = [...sessionSteps, step];

    const isLastLevel = currentLevelIndex >= levels.length - 1;
    if (isLastLevel) {
      const timerInterval = get().timerInterval;
      if (timerInterval) clearInterval(timerInterval);

      const completed: Session = {
        ...currentSession,
        endTime: Date.now(),
        score: newScore,
        maxCombo: newMaxCombo,
        status: "completed",
      };

      const allSessions = loadSessions();
      allSessions.push(completed);
      saveSessions(allSessions);
      saveSteps(completed.id, newSteps);

      set({
        currentSession: completed,
        sessionSteps: newSteps,
        score: newScore,
        combo: newCombo,
        maxCombo: newMaxCombo,
        feedback,
        gameStatus: "completed",
        timerInterval: null,
      });
    } else {
      const nextLevel = levels[currentLevelIndex + 1];
      set({
        currentLevelIndex: currentLevelIndex + 1,
        sessionSteps: newSteps,
        score: newScore,
        combo: newCombo,
        maxCombo: newMaxCombo,
        feedback,
        timer: nextLevel.timeLimit * 10,
        levelStartTime: Date.now(),
      });
    }
  },

  tick: () => {
    const { gameStatus, timer, currentGroupId, currentLevelIndex } = get();
    if (gameStatus !== "playing" || timer <= 0) return;

    const newTimer = timer - 1;
    if (newTimer <= 0) {
      const levels = getLevelsByGroup(currentGroupId!);
      const level = levels[currentLevelIndex];

      const { currentSession, sessionSteps, levelStartTime, combo, maxCombo } = get();
      const timeSpent = (Date.now() - levelStartTime) / 1000;

      const step: SessionStep = {
        id: genId(),
        sessionId: currentSession!.id,
        levelId: level.id,
        stepOrder: sessionSteps.length,
        selectedOption: null,
        correct: false,
        timeSpent: Math.round(timeSpent * 100) / 100,
        failType: "too_slow",
        timestamp: Date.now(),
      };

      const newSteps = [...sessionSteps, step];
      const newCombo = 0;

      const feedback: FeedbackInfo = {
        correct: false,
        failType: "too_slow",
        message: "时间到了！",
        detail: `超时未作答，本关正确答案是 ${level.targetChord} = ${level.targetNotes.join(" - ")}`,
      };

      const isLastLevel = currentLevelIndex >= levels.length - 1;
      if (isLastLevel) {
        const timerInterval = get().timerInterval;
        if (timerInterval) clearInterval(timerInterval);

        const completed: Session = {
          ...currentSession!,
          endTime: Date.now(),
          score: get().score,
          maxCombo,
          status: "completed",
        };

        const allSessions = loadSessions();
        allSessions.push(completed);
        saveSessions(allSessions);
        saveSteps(completed.id, newSteps);

        set({
          currentSession: completed,
          sessionSteps: newSteps,
          combo: newCombo,
          feedback,
          timer: 0,
          gameStatus: "completed",
          timerInterval: null,
        });
      } else {
        const nextLevel = levels[currentLevelIndex + 1];
        set({
          currentLevelIndex: currentLevelIndex + 1,
          sessionSteps: newSteps,
          combo: newCombo,
          feedback,
          timer: nextLevel.timeLimit * 10,
          levelStartTime: Date.now(),
        });
      }
    } else {
      set({ timer: newTimer });
    }
  },

  clearFeedback: () => set({ feedback: null }),

  reset: () => {
    const { timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);
    set({
      gameStatus: "idle",
      currentGroupId: null,
      currentLevelIndex: 0,
      currentSession: null,
      sessionSteps: [],
      timer: 0,
      levelStartTime: 0,
      feedback: null,
      score: 0,
      combo: 0,
      maxCombo: 0,
      timerInterval: null,
    });
  },
}));
