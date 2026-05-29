import { create } from 'zustand';

interface PlayerState {
  isPlaying: boolean;
  currentStep: number;
  isMetronomeEnabled: boolean;
  audioContext: AudioContext | null;
  setIsPlaying: (playing: boolean) => void;
  setCurrentStep: (step: number) => void;
  toggleMetronome: () => void;
  initAudioContext: () => void;
  closeAudioContext: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  isPlaying: false,
  currentStep: -1,
  isMetronomeEnabled: true,
  audioContext: null,

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setCurrentStep: (step) => set({ currentStep: step }),

  toggleMetronome: () => set((state) => ({ isMetronomeEnabled: !state.isMetronomeEnabled })),

  initAudioContext: () => {
    if (!get().audioContext) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      set({ audioContext: ctx });
    }
  },

  closeAudioContext: () => {
    const ctx = get().audioContext;
    if (ctx) {
      ctx.close();
      set({ audioContext: null });
    }
  },
}));
