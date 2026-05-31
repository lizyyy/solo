import { create } from 'zustand';
import type { TimeFormat, PlaybackState, ContextMenuState } from '../types';

interface PlaybackStore extends PlaybackState {
  primaryTimeFormat: TimeFormat;
  showCommandList: boolean;
  showDetailPanel: boolean;
  contextMenu: ContextMenuState;
  isBriefingOpen: boolean;

  setPrimaryTimeFormat: (format: TimeFormat) => void;
  setPlaying: (isPlaying: boolean) => void;
  togglePlaying: () => void;
  setCurrentTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: number) => void;
  setTimeRange: (start: number, end: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  toggleCommandList: () => void;
  toggleDetailPanel: () => void;
  showContextMenu: (x: number, y: number, commandId: string) => void;
  hideContextMenu: () => void;
  openBriefing: () => void;
  closeBriefing: () => void;
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  playbackSpeed: 1,
  startTime: 0,
  endTime: 7200,
  zoom: 1,
  pan: 0,
  primaryTimeFormat: 'UTC',
  showCommandList: true,
  showDetailPanel: true,
  contextMenu: {
    visible: false,
    x: 0,
    y: 0,
    commandId: null,
  },
  isBriefingOpen: false,

  setPrimaryTimeFormat: (format: TimeFormat) => {
    set({ primaryTimeFormat: format });
  },

  setPlaying: (isPlaying: boolean) => {
    set({ isPlaying });
  },

  togglePlaying: () => {
    set({ isPlaying: !get().isPlaying });
  },

  setCurrentTime: (time: number) => {
    const { startTime, endTime } = get();
    const clampedTime = Math.max(startTime, Math.min(endTime, time));
    set({ currentTime: clampedTime });
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
  },

  setZoom: (zoom: number) => {
    const clampedZoom = Math.max(0.5, Math.min(5, zoom));
    set({ zoom: clampedZoom });
  },

  setPan: (pan: number) => {
    set({ pan });
  },

  setTimeRange: (start: number, end: number) => {
    set({ startTime: start, endTime: end });
  },

  stepForward: () => {
    const { currentTime, endTime } = get();
    const step = 60;
    set({ currentTime: Math.min(endTime, currentTime + step) });
  },

  stepBackward: () => {
    const { currentTime, startTime } = get();
    const step = 60;
    set({ currentTime: Math.max(startTime, currentTime - step) });
  },

  jumpToStart: () => {
    set({ currentTime: get().startTime });
  },

  jumpToEnd: () => {
    set({ currentTime: get().endTime });
  },

  toggleCommandList: () => {
    set({ showCommandList: !get().showCommandList });
  },

  toggleDetailPanel: () => {
    set({ showDetailPanel: !get().showDetailPanel });
  },

  showContextMenu: (x: number, y: number, commandId: string) => {
    set({
      contextMenu: {
        visible: true,
        x,
        y,
        commandId,
      },
    });
  },

  hideContextMenu: () => {
    set({
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        commandId: null,
      },
    });
  },

  openBriefing: () => {
    set({ isBriefingOpen: true });
  },

  closeBriefing: () => {
    set({ isBriefingOpen: false });
  },
}));
