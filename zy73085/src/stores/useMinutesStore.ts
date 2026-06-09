import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MeetingMinutes } from "@/types";
import { mockMinutes } from "@/data/mockData";
import { buildMinutesFromRaw } from "@/utils/fieldCompat";

interface MinutesState {
  minutes: MeetingMinutes[];
  selectedId: string | null;
  addMinutes: (raw: Record<string, any>) => MeetingMinutes;
  updateStatus: (id: string, status: MeetingMinutes["status"]) => void;
  remove: (id: string) => void;
  setSelected: (id: string | null) => void;
  resetMock: () => void;
}

export const useMinutesStore = create<MinutesState>()(
  persist(
    (set, get) => ({
      minutes: mockMinutes,
      selectedId: null,
      addMinutes: (raw) => {
        const m = buildMinutesFromRaw(raw);
        set({ minutes: [m, ...get().minutes] });
        return m;
      },
      updateStatus: (id, status) =>
        set({
          minutes: get().minutes.map((m) =>
            m.id === id ? { ...m, status, updatedAt: new Date().toISOString() } : m
          ),
        }),
      remove: (id) => set({ minutes: get().minutes.filter((m) => m.id !== id) }),
      setSelected: (id) => set({ selectedId: id }),
      resetMock: () => set({ minutes: mockMinutes, selectedId: null }),
    }),
    { name: "sgr-minutes-store" }
  )
);
