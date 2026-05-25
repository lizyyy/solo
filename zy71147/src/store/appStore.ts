
import { create } from 'zustand';
import { AppState, AppActions, SampleType, Vector3, VisibilityState } from '../types';
import { samples } from '../data/samples';
import { checkAllCollisions } from '../utils/collision';

const initialVisibility: VisibilityState = {
  blocks: true,
  piers: true,
  rails: true,
  liftingPoints: true,
  liftingPaths: true,
  collisionMarkers: true,
};

const initialSample: SampleType = 'normal';
const initialData = samples[initialSample];

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  currentSample: initialSample,
  sceneData: initialData,
  collisions: checkAllCollisions(
    initialData.blocks,
    initialData.piers,
    initialData.rails,
    initialData.liftingPaths,
    0
  ),
  timelineProgress: 0,
  isPlaying: false,
  selectedBlockId: null,
  visibility: initialVisibility,
  cameraView: {
    position: { x: 50, y: 40, z: 50 },
    target: { x: 0, y: 0, z: 0 },
  },
  showComparison: false,
  comparisonSample: null,

  setCurrentSample: (sample: SampleType) => {
    const data = samples[sample];
    set({
      currentSample: sample,
      sceneData: data,
      timelineProgress: 0,
      isPlaying: false,
      selectedBlockId: null,
      collisions: checkAllCollisions(
        data.blocks,
        data.piers,
        data.rails,
        data.liftingPaths,
        0
      ),
    });
  },

  setTimelineProgress: (progress: number) => {
    const { sceneData } = get();
    const clampedProgress = Math.max(0, Math.min(1, progress));
    set({
      timelineProgress: clampedProgress,
      collisions: checkAllCollisions(
        sceneData.blocks,
        sceneData.piers,
        sceneData.rails,
        sceneData.liftingPaths,
        clampedProgress
      ),
    });
  },

  setIsPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  setSelectedBlockId: (id: string | null) => {
    set({ selectedBlockId: id });
  },

  setVisibility: (visibility: Partial<VisibilityState>) => {
    set((state) => ({
      visibility: { ...state.visibility, ...visibility },
    }));
  },

  setCameraView: (view) => {
    set({ cameraView: view });
  },

  resetScene: () => {
    const { currentSample } = get();
    const data = samples[currentSample];
    set({
      sceneData: data,
      timelineProgress: 0,
      isPlaying: false,
      selectedBlockId: null,
      collisions: checkAllCollisions(
        data.blocks,
        data.piers,
        data.rails,
        data.liftingPaths,
        0
      ),
    });
  },

  toggleComparison: (show: boolean) => {
    set({ showComparison: show });
  },

  setComparisonSample: (sample: SampleType | null) => {
    set({ comparisonSample: sample });
  },

  updateBlockPosition: (blockId: string, position: Vector3) => {
    const { sceneData } = get();
    const updatedBlocks = sceneData.blocks.map((block) =>
      block.id === blockId ? { ...block, position, startPosition: position } : block
    );
    const updatedPaths = sceneData.liftingPaths.map((path) => {
      if (path.blockId !== blockId || path.waypoints.length < 2) return path;
      return {
        ...path,
        waypoints: [position, ...path.waypoints.slice(1)],
      };
    });
    const updatedSceneData = { ...sceneData, blocks: updatedBlocks, liftingPaths: updatedPaths };
    set({
      sceneData: updatedSceneData,
      collisions: checkAllCollisions(
        updatedBlocks,
        sceneData.piers,
        sceneData.rails,
        updatedPaths,
        get().timelineProgress
      ),
    });
  },

  checkCollisions: () => {
    const { sceneData, timelineProgress } = get();
    const collisions = checkAllCollisions(
      sceneData.blocks,
      sceneData.piers,
      sceneData.rails,
      sceneData.liftingPaths,
      timelineProgress
    );
    set({ collisions });
  },
}));

