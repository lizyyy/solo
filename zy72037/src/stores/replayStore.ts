import { create } from "zustand";
import type { SessionStep } from "@/types";
import { loadSteps } from "@/utils/storage";
import { getLevelsByGroup } from "@/data/levels";

interface ReplayStore {
  sessionId: string | null;
  groupId: string | null;
  steps: SessionStep[];
  currentIndex: number;
  isPlaying: boolean;
  playSpeed: number;
  playInterval: ReturnType<typeof setInterval> | null;

  startReplay: (sessionId: string, groupId: string) => void;
  play: () => void;
  pause: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  setSpeed: (speed: number) => void;
  stopReplay: () => void;
}

export const useReplayStore = create<ReplayStore>((set, get) => ({
  sessionId: null,
  groupId: null,
  steps: [],
  currentIndex: -1,
  isPlaying: false,
  playSpeed: 1,
  playInterval: null,

  startReplay: (sessionId: string, groupId: string) => {
    const steps = loadSteps(sessionId);
    set({ sessionId, groupId, steps, currentIndex: -1, isPlaying: false });
  },

  play: () => {
    const { isPlaying, playInterval, steps, currentIndex, playSpeed } = get();
    if (isPlaying) return;
    if (playInterval) clearInterval(playInterval);

    if (currentIndex >= steps.length - 1) {
      set({ currentIndex: -1 });
    }

    const interval = setInterval(() => {
      const state = get();
      if (state.currentIndex >= state.steps.length - 1) {
        if (state.playInterval) clearInterval(state.playInterval);
        set({ isPlaying: false, playInterval: null });
        return;
      }
      set({ currentIndex: state.currentIndex + 1 });
    }, 1500 / playSpeed);

    set({ isPlaying: true, playInterval: interval });
  },

  pause: () => {
    const { playInterval } = get();
    if (playInterval) clearInterval(playInterval);
    set({ isPlaying: false, playInterval: null });
  },

  nextStep: () => {
    const { currentIndex, steps } = get();
    if (currentIndex < steps.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  prevStep: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  goToStep: (index: number) => {
    const { steps } = get();
    if (index >= 0 && index < steps.length) {
      set({ currentIndex: index });
    }
  },

  setSpeed: (speed: number) => {
    const { isPlaying } = get();
    set({ playSpeed: speed });
    if (isPlaying) {
      get().pause();
      get().play();
    }
  },

  stopReplay: () => {
    const { playInterval } = get();
    if (playInterval) clearInterval(playInterval);
    set({ sessionId: null, groupId: null, steps: [], currentIndex: -1, isPlaying: false, playSpeed: 1, playInterval: null });
  },
}));

export function getReplayLevelInfo(groupId: string, levelId: string) {
  const levels = getLevelsByGroup(groupId);
  return levels.find((l) => l.id === levelId);
}
