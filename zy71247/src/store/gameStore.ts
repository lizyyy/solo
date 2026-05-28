import { create } from 'zustand';
import { GameParams, ImagingResult, GamePhase, SceneConfig } from '../types';
import { scenes, getSceneById } from '../data/scenes';
import { simulateSARImaging } from '../engine/SARImaging';
import {
  calculateTrackAccuracy,
  calculateSamplingAdequacy,
  calculateNoiseControl,
  calculateImageClarity,
  calculateTotalScore,
  analyzeErrors
} from '../engine/Scoring';

interface GameState {
  phase: GamePhase;
  currentSceneId: string;
  params: GameParams;
  result: ImagingResult | null;
  previewImage: number[][] | null;
  
  setCurrentScene: (sceneId: string) => void;
  updateParams: (updates: Partial<GameParams>) => void;
  generatePreview: () => void;
  submitForReview: () => void;
  resetGame: () => void;
  getCurrentScene: () => SceneConfig | undefined;
  getScenes: () => SceneConfig[];
}

const defaultParams: GameParams = {
  flightPath: {
    offsetX: 25,
    offsetY: 15,
    curvature: 0
  },
  sampling: {
    interval: 10,
    count: 64,
    apertureSize: 32
  },
  noise: {
    level: 35,
    type: 'gaussian'
  },
  sceneId: 'circle'
};

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'playing',
  currentSceneId: 'circle',
  params: defaultParams,
  result: null,
  previewImage: null,

  setCurrentScene: (sceneId: string) => {
    set({
      currentSceneId: sceneId,
      params: { ...get().params, sceneId },
      previewImage: null
    });
  },

  updateParams: (updates) => {
    set((state) => ({
      params: {
        ...state.params,
        ...updates,
        flightPath: { ...state.params.flightPath, ...updates.flightPath },
        sampling: { ...state.params.sampling, ...updates.sampling },
        noise: { ...state.params.noise, ...updates.noise }
      }
    }));
  },

  generatePreview: () => {
    const state = get();
    const scene = getSceneById(state.currentSceneId);
    if (!scene) return;

    const { processedImage } = simulateSARImaging(scene, state.params);
    set({ previewImage: processedImage });
  },

  submitForReview: () => {
    const state = get();
    const scene = getSceneById(state.currentSceneId);
    if (!scene) return;

    set({ phase: 'processing' });

    setTimeout(() => {
      const { echoData, processedImage } = simulateSARImaging(scene, state.params);

      const trackAccuracy = calculateTrackAccuracy(state.params, scene);
      const samplingAdequacy = calculateSamplingAdequacy(state.params, scene);
      const noiseControl = calculateNoiseControl(state.params, scene);
      const imageClarity = calculateImageClarity(processedImage, scene.targetImage);

      const scores = {
        trackAccuracy,
        samplingAdequacy,
        noiseControl,
        imageClarity,
        totalScore: calculateTotalScore({
          trackAccuracy,
          samplingAdequacy,
          noiseControl,
          imageClarity
        })
      };

      const errors = analyzeErrors(state.params, scene, {
        trackAccuracy,
        samplingAdequacy,
        noiseControl
      });

      const result: ImagingResult = {
        rawEcho: echoData,
        processedImage,
        scores,
        errors,
        params: { ...state.params },
        timestamp: Date.now()
      };

      set({ result, phase: 'review' });
    }, 1500);
  },

  resetGame: () => {
    set({
      phase: 'playing',
      params: { ...defaultParams },
      result: null,
      previewImage: null
    });
  },

  getCurrentScene: () => getSceneById(get().currentSceneId),
  getScenes: () => scenes
}));
