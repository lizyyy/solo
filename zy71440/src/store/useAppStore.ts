import { create } from 'zustand';
import type { AppState, AppActions, Vec3, LightRay, Viewpoint, StarField } from '../types';
import { DEFAULT_BLACK_HOLE, generateBlackHole } from '../data/blackHoles';
import { generateLightRays } from '../data/lightRays';
import { generateStarField } from '../data/starField';
import { DEFAULT_VIEWPOINTS, createViewpoint } from '../data/viewpoints';
import { runFullQualityCheck } from '../quality/checker';
import { DEFAULT_PARAMETERS } from '../physics/constants';

const initialRays = generateLightRays(
  DEFAULT_BLACK_HOLE.id,
  DEFAULT_PARAMETERS.rayCount,
  DEFAULT_BLACK_HOLE.mass,
  DEFAULT_PARAMETERS.observerDistance,
  DEFAULT_PARAMETERS.lensStrength
);

const initialStarField = generateStarField(
  500,
  80,
  DEFAULT_PARAMETERS.starDensity,
  DEFAULT_BLACK_HOLE.mass,
  DEFAULT_VIEWPOINTS[0].cameraPosition,
  DEFAULT_PARAMETERS.lensStrength
);

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  blackHole: DEFAULT_BLACK_HOLE,
  lightRays: initialRays,
  starField: initialStarField,
  viewpoints: DEFAULT_VIEWPOINTS,
  qualityReport: null,
  visibility: {
    blackHole: true,
    lightRays: true,
    starField: true,
  },
  selectedObject: null,
  parameters: { ...DEFAULT_PARAMETERS },
  cameraPosition: DEFAULT_VIEWPOINTS[0].cameraPosition,
  cameraTarget: DEFAULT_VIEWPOINTS[0].cameraTarget,

  setBlackHoleMass: (mass: number) => {
    const newBH = generateBlackHole(mass);
    const { parameters, cameraPosition } = get();
    const newRays = generateLightRays(
      newBH.id,
      parameters.rayCount,
      mass,
      parameters.observerDistance,
      parameters.lensStrength
    );
    const newStars = generateStarField(
      500,
      80,
      parameters.starDensity,
      mass,
      cameraPosition,
      parameters.lensStrength
    );
    set({ blackHole: newBH, lightRays: newRays, starField: newStars });
    get().runQualityCheck();
  },

  setRayCount: (count: number) => {
    const { blackHole, parameters } = get();
    const newRays = generateLightRays(
      blackHole.id,
      count,
      blackHole.mass,
      parameters.observerDistance,
      parameters.lensStrength
    );
    set(state => ({
      lightRays: newRays,
      parameters: { ...state.parameters, rayCount: count },
    }));
    get().runQualityCheck();
  },

  setObserverDistance: (distance: number) => {
    const { blackHole, parameters } = get();
    const newRays = generateLightRays(
      blackHole.id,
      parameters.rayCount,
      blackHole.mass,
      distance,
      parameters.lensStrength
    );
    set(state => ({
      lightRays: newRays,
      parameters: { ...state.parameters, observerDistance: distance },
    }));
    get().runQualityCheck();
  },

  setStarDensity: (density: number) => {
    const { blackHole, parameters, cameraPosition } = get();
    const newStars = generateStarField(
      500,
      80,
      density,
      blackHole.mass,
      cameraPosition,
      parameters.lensStrength
    );
    set(state => ({
      starField: newStars,
      parameters: { ...state.parameters, starDensity: density },
    }));
    get().runQualityCheck();
  },

  setLensStrength: (strength: number) => {
    const { blackHole, parameters, cameraPosition } = get();
    const newRays = generateLightRays(
      blackHole.id,
      parameters.rayCount,
      blackHole.mass,
      parameters.observerDistance,
      strength
    );
    const newStars = generateStarField(
      500,
      80,
      parameters.starDensity,
      blackHole.mass,
      cameraPosition,
      strength
    );
    set(state => ({
      lightRays: newRays,
      starField: newStars,
      parameters: { ...state.parameters, lensStrength: strength },
    }));
    get().runQualityCheck();
  },

  setVisibility: (visibility: Partial<AppState['visibility']>) => {
    set(state => ({
      visibility: { ...state.visibility, ...visibility },
    }));
  },

  setSelectedObject: (obj) => set({ selectedObject: obj }),

  saveViewpoint: (name: string) => {
    const { cameraPosition, cameraTarget, viewpoints, parameters } = get();
    const newVp = createViewpoint(name, cameraPosition, cameraTarget, 50);
    set({ viewpoints: [...viewpoints, newVp] });
  },

  restoreViewpoint: (id: string) => {
    const vp = get().viewpoints.find(v => v.id === id);
    if (vp) {
      set({
        cameraPosition: vp.cameraPosition,
        cameraTarget: vp.cameraTarget,
      });
      get().runQualityCheck();
    }
  },

  deleteViewpoint: (id: string) => {
    set(state => ({
      viewpoints: state.viewpoints.filter(v => v.id !== id),
    }));
  },

  runQualityCheck: () => {
    const { blackHole, lightRays, starField, cameraPosition, parameters } = get();
    const report = runFullQualityCheck({
      blackHole,
      lightRays,
      stars: starField.stars,
      cameraPosition,
      rayCount: parameters.rayCount,
      starDensity: parameters.starDensity,
    });
    set({ qualityReport: report });
  },

  updateCamera: (position: Vec3, target: Vec3) => {
    set({ cameraPosition: position, cameraTarget: target });
  },

  recalculateRays: () => {
    const { blackHole, parameters } = get();
    const newRays = generateLightRays(
      blackHole.id,
      parameters.rayCount,
      blackHole.mass,
      parameters.observerDistance,
      parameters.lensStrength
    );
    set({ lightRays: newRays });
    get().runQualityCheck();
  },

  regenerateStarField: () => {
    const { blackHole, parameters, cameraPosition } = get();
    const newStars = generateStarField(
      500,
      80,
      parameters.starDensity,
      blackHole.mass,
      cameraPosition,
      parameters.lensStrength
    );
    set({ starField: newStars });
    get().runQualityCheck();
  },
}));
