import { create } from 'zustand';
import type { ViewState, Position3D } from '../types';

interface ViewStore extends ViewState {
  setCameraPosition: (position: Position3D) => void;
  setCameraTarget: (target: Position3D) => void;
  resetCamera: () => void;
  setSelectedElement: (id: string | null, type: 'shelf' | 'robot' | 'station' | 'path' | null) => void;
  clearSelection: () => void;
  setIsPlayingTimeline: (isPlaying: boolean) => void;
  togglePlayback: () => void;
  setTimelinePlaybackSpeed: (speed: number) => void;
  increasePlaybackSpeed: () => void;
  decreasePlaybackSpeed: () => void;
}

const getInitialState = (): ViewState => ({
  cameraPosition: { x: 35, y: 40, z: 35 },
  cameraTarget: { x: 25, y: 12.5, z: 0 },
  selectedElementId: null,
  selectedElementType: null,
  isPlayingTimeline: false,
  timelinePlaybackSpeed: 1,
});

export const useViewStore = create<ViewStore>((set) => ({
  ...getInitialState(),

  setCameraPosition: (position) => set({ cameraPosition: position }),

  setCameraTarget: (target) => set({ cameraTarget: target }),

  resetCamera: () =>
    set({
      cameraPosition: { x: 35, y: 40, z: 35 },
      cameraTarget: { x: 25, y: 12.5, z: 0 },
    }),

  setSelectedElement: (id, type) =>
    set({
      selectedElementId: id,
      selectedElementType: type,
    }),

  clearSelection: () =>
    set({
      selectedElementId: null,
      selectedElementType: null,
    }),

  setIsPlayingTimeline: (isPlaying) => set({ isPlayingTimeline: isPlaying }),

  togglePlayback: () =>
    set((state) => ({ isPlayingTimeline: !state.isPlayingTimeline })),

  setTimelinePlaybackSpeed: (speed) =>
    set({ timelinePlaybackSpeed: Math.max(0.25, Math.min(4, speed)) }),

  increasePlaybackSpeed: () =>
    set((state) => ({
      timelinePlaybackSpeed: Math.min(4, state.timelinePlaybackSpeed * 2),
    })),

  decreasePlaybackSpeed: () =>
    set((state) => ({
      timelinePlaybackSpeed: Math.max(0.25, state.timelinePlaybackSpeed / 2),
    })),
}));
