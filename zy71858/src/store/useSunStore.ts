import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SunState {
  sunTime: number;
  setSunTime: (time: number) => void;
  getSunPosition: () => { x: number; y: number; z: number };
}

export const useSunStore = create<SunState>()(
  persist(
    (set, get) => ({
      sunTime: 12,

      setSunTime: (time) => {
        set({ sunTime: Math.max(0, Math.min(24, time)) });
      },

      getSunPosition: () => {
        const { sunTime } = get();
        const angle = ((sunTime - 6) / 12) * Math.PI;
        const radius = 100;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const z = -30;
        return { x, y, z };
      },
    }),
    {
      name: 'sunshine-sun-storage',
    }
  )
);
