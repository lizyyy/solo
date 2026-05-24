import { create } from 'zustand';
import { SceneData, SceneElement, Vector3Tuple, CameraMode, PathData } from '@/types';

interface SceneState {
  currentScene: SceneData | null;
  elements: SceneElement[];
  paths: PathData[];
  selectedElement: string | null;
  cameraMode: CameraMode;
  cameraPosition: Vector3Tuple;
  cameraRotation: Vector3Tuple;
  isPlaying: boolean;
  playbackSpeed: number;
  currentTime: number;
  totalDuration: number;
  activePath: string | null;
  setCurrentScene: (scene: SceneData | null) => void;
  setElements: (elements: SceneElement[]) => void;
  setPaths: (paths: PathData[]) => void;
  setSelectedElement: (id: string | null) => void;
  setCameraMode: (mode: CameraMode) => void;
  setCameraPosition: (pos: Vector3Tuple) => void;
  setCameraRotation: (rot: Vector3Tuple) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setCurrentTime: (time: number) => void;
  setTotalDuration: (duration: number) => void;
  setActivePath: (id: string | null) => void;
  toggleElementVisibility: (id: string) => void;
  resetScene: () => void;
}

const initialState = {
  currentScene: null,
  elements: [],
  paths: [],
  selectedElement: null,
  cameraMode: 'orbit' as CameraMode,
  cameraPosition: [0, 15, 20] as Vector3Tuple,
  cameraRotation: [0, 0, 0] as Vector3Tuple,
  isPlaying: false,
  playbackSpeed: 1,
  currentTime: 0,
  totalDuration: 100,
  activePath: null,
};

export const useSceneStore = create<SceneState>((set, get) => ({
  ...initialState,
  
  setCurrentScene: (scene) => set({ currentScene: scene }),
  setElements: (elements) => set({ elements }),
  setPaths: (paths) => set({ paths }),
  setSelectedElement: (id) => set({ selectedElement: id }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setCameraPosition: (pos) => set({ cameraPosition: pos }),
  setCameraRotation: (rot) => set({ cameraRotation: rot }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setTotalDuration: (duration) => set({ totalDuration: duration }),
  setActivePath: (id) => set({ activePath: id }),
  
  toggleElementVisibility: (id) => {
    const { elements } = get();
    set({
      elements: elements.map(el =>
        el.id === id ? { ...el, visible: !el.visible } : el
      ),
    });
  },
  
  resetScene: () => {
    const { currentScene } = get();
    if (currentScene) {
      set({
        elements: currentScene.elements.map(el => ({ ...el, visible: true })),
        selectedElement: null,
        cameraPosition: [0, 15, 20],
        cameraRotation: [0, 0, 0],
        isPlaying: false,
        currentTime: 0,
        activePath: null,
      });
    }
  },
}));
