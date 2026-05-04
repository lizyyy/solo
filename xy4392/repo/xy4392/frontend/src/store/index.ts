import { create } from 'zustand';
import { 
  LightingPlan, 
  PlacedLight, 
  Actor, 
  Camera, 
  ScheduleItem, 
  RiskItem,
  StudioDimensions,
  EditorState 
} from '@/types';

interface AppState {
  currentPlanId: string | null;
  plan: LightingPlan | null;
  lights: PlacedLight[];
  actors: Actor[];
  cameras: Camera[];
  schedule: ScheduleItem[];
  risks: RiskItem[];
  editor: EditorState;
  isLoading: boolean;
  
  setPlan: (plan: LightingPlan) => void;
  setPlanDetail: (detail: {
    plan: LightingPlan;
    lights: PlacedLight[];
    actors: Actor[];
    cameras: Camera[];
    schedule: ScheduleItem[];
    risks: RiskItem[];
  }) => void;
  clearPlan: () => void;
  
  setStudioDimensions: (dimensions: StudioDimensions) => void;
  
  addLight: (light: PlacedLight) => void;
  updateLight: (id: string, updates: Partial<PlacedLight>) => void;
  removeLight: (id: string) => void;
  setLights: (lights: PlacedLight[]) => void;
  
  addActor: (actor: Actor) => void;
  updateActor: (id: string, updates: Partial<Actor>) => void;
  removeActor: (id: string) => void;
  setActors: (actors: Actor[]) => void;
  
  addCamera: (camera: Camera) => void;
  updateCamera: (id: string, updates: Partial<Camera>) => void;
  removeCamera: (id: string) => void;
  setCameras: (cameras: Camera[]) => void;
  
  addScheduleItem: (item: ScheduleItem) => void;
  updateScheduleItem: (id: string, updates: Partial<ScheduleItem>) => void;
  removeScheduleItem: (id: string) => void;
  setSchedule: (schedule: ScheduleItem[]) => void;
  
  setRisks: (risks: RiskItem[]) => void;
  updateRisk: (id: string, updates: Partial<RiskItem>) => void;
  
  setSelectedObject: (id: string | null, type: 'light' | 'actor' | 'camera' | null) => void;
  setDragging: (isDragging: boolean) => void;
  setDragPlane: (plane: 'xy' | 'xz' | 'yz') => void;
  
  setLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  currentPlanId: null,
  plan: null,
  lights: [],
  actors: [],
  cameras: [],
  schedule: [],
  risks: [],
  editor: {
    selectedObjectId: null,
    selectedType: null,
    isDragging: false,
    dragPlane: 'xz'
  },
  isLoading: false,

  setPlan: (plan) => set({ plan, currentPlanId: plan.id }),
  
  setPlanDetail: ({ plan, lights, actors, cameras, schedule, risks }) => set({
    currentPlanId: plan.id,
    plan,
    lights,
    actors,
    cameras,
    schedule,
    risks
  }),
  
  clearPlan: () => set({
    currentPlanId: null,
    plan: null,
    lights: [],
    actors: [],
    cameras: [],
    schedule: [],
    risks: [],
    editor: {
      selectedObjectId: null,
      selectedType: null,
      isDragging: false,
      dragPlane: 'xz'
    }
  }),

  setStudioDimensions: (dimensions) => set((state) => ({
    plan: state.plan ? {
      ...state.plan,
      studioDimensions: dimensions
    } : null
  })),

  addLight: (light) => set((state) => ({
    lights: [...state.lights, light],
    plan: state.plan ? {
      ...state.plan,
      totalPower: state.plan.totalPower + light.power
    } : null
  })),
  
  updateLight: (id, updates) => set((state) => {
    const oldLight = state.lights.find(l => l.id === id);
    const lights = state.lights.map(l => 
      l.id === id ? { ...l, ...updates } : l
    );
    
    let totalPower = state.plan?.totalPower || 0;
    if (oldLight && updates.power !== undefined) {
      totalPower = totalPower - oldLight.power + updates.power;
    }
    
    return {
      lights,
      plan: state.plan ? { ...state.plan, totalPower } : null
    };
  }),
  
  removeLight: (id) => set((state) => {
    const light = state.lights.find(l => l.id === id);
    return {
      lights: state.lights.filter(l => l.id !== id),
      plan: state.plan && light ? {
        ...state.plan,
        totalPower: state.plan.totalPower - light.power
      } : null,
      editor: state.editor.selectedObjectId === id ? {
        ...state.editor,
        selectedObjectId: null,
        selectedType: null
      } : state.editor
    };
  }),
  
  setLights: (lights) => set({ lights }),

  addActor: (actor) => set((state) => ({
    actors: [...state.actors, actor]
  })),
  
  updateActor: (id, updates) => set((state) => ({
    actors: state.actors.map(a => 
      a.id === id ? { ...a, ...updates } : a
    )
  })),
  
  removeActor: (id) => set((state) => ({
    actors: state.actors.filter(a => a.id !== id),
    editor: state.editor.selectedObjectId === id ? {
      ...state.editor,
      selectedObjectId: null,
      selectedType: null
    } : state.editor
  })),
  
  setActors: (actors) => set({ actors }),

  addCamera: (camera) => set((state) => ({
    cameras: [...state.cameras, camera]
  })),
  
  updateCamera: (id, updates) => set((state) => ({
    cameras: state.cameras.map(c => 
      c.id === id ? { ...c, ...updates } : c
    )
  })),
  
  removeCamera: (id) => set((state) => ({
    cameras: state.cameras.filter(c => c.id !== id),
    editor: state.editor.selectedObjectId === id ? {
      ...state.editor,
      selectedObjectId: null,
      selectedType: null
    } : state.editor
  })),
  
  setCameras: (cameras) => set({ cameras }),

  addScheduleItem: (item) => set((state) => ({
    schedule: [...state.schedule, item]
  })),
  
  updateScheduleItem: (id, updates) => set((state) => ({
    schedule: state.schedule.map(s => 
      s.id === id ? { ...s, ...updates } : s
    )
  })),
  
  removeScheduleItem: (id) => set((state) => ({
    schedule: state.schedule.filter(s => s.id !== id)
  })),
  
  setSchedule: (schedule) => set({ schedule }),

  setRisks: (risks) => set({ risks }),
  
  updateRisk: (id, updates) => set((state) => ({
    risks: state.risks.map(r => 
      r.id === id ? { ...r, ...updates } : r
    )
  })),

  setSelectedObject: (id, type) => set((state) => ({
    editor: {
      ...state.editor,
      selectedObjectId: id,
      selectedType: type
    }
  })),
  
  setDragging: (isDragging) => set((state) => ({
    editor: { ...state.editor, isDragging }
  })),
  
  setDragPlane: (dragPlane) => set((state) => ({
    editor: { ...state.editor, dragPlane }
  })),

  setLoading: (isLoading) => set({ isLoading })
}));
