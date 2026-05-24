import { create } from 'zustand';

interface TimeState {
  month: number;
  day: number;
  hour: number;
  isPlaying: boolean;
  playSpeed: number;
}

interface TimeActions {
  setMonth: (month: number) => void;
  setDay: (day: number) => void;
  setHour: (hour: number) => void;
  setTime: (month: number, day: number, hour: number) => void;
  togglePlay: () => void;
  setPlaySpeed: (speed: number) => void;
  reset: () => void;
}

export const useTimeStore = create<TimeState & TimeActions>((set) => ({
  month: 6,
  day: 15,
  hour: 12,
  isPlaying: false,
  playSpeed: 1,

  setMonth: (month) => set({ month: Math.max(1, Math.min(12, month)) }),
  setDay: (day) => set({ day: Math.max(1, Math.min(31, day)) }),
  setHour: (hour) => set({ hour: Math.max(0, Math.min(24, hour)) }),
  setTime: (month, day, hour) => set({ month, day, hour }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaySpeed: (speed) => set({ playSpeed: Math.max(0.1, Math.min(10, speed)) }),
  reset: () => set({
    month: 6,
    day: 15,
    hour: 12,
    isPlaying: false,
    playSpeed: 1,
  }),
}));
