import { create } from 'zustand'
import type {
  ProjectState,
  Light,
  Actor,
  Prop,
  Trajectory,
  ValidationResult,
  OcclusionResult,
  ActorLightStatus,
  SelectedElement,
  FilterState,
  PlaybackState,
  Scene,
  SavedProject,
} from '@/types'

const STORAGE_KEY = 'stage-lighting-projects'
const CURRENT_PROJECT_KEY = 'stage-lighting-current'

interface ProjectStore extends ProjectState {
  setScene: (scene: Scene) => void
  addLights: (lights: Light[]) => void
  addActors: (actors: Actor[]) => void
  addProps: (props: Prop[]) => void
  addTrajectories: (trajectories: Trajectory[]) => void
  setValidationResults: (results: ValidationResult[]) => void
  setOcclusionResults: (results: OcclusionResult[]) => void
  setActorLightStatus: (status: ActorLightStatus[]) => void
  setSelectedElement: (element: SelectedElement | null) => void
  setFilters: (filters: Partial<FilterState>) => void
  setPlayback: (playback: Partial<PlaybackState>) => void
  setCurrentTime: (time: number) => void
  togglePlaying: () => void
  addImportedFile: (fileName: string) => void
  clearAll: () => void
  saveProject: (name: string, thumbnail?: string) => void
  loadProject: (id: string) => void
  deleteProject: (id: string) => void
  getSavedProjects: () => SavedProject[]
  exportProject: () => string
  importProject: (data: string) => void
}

const createInitialState = (): ProjectState => {
  const saved = localStorage.getItem(CURRENT_PROJECT_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      // fall through
    }
  }

  return {
    scene: {
      id: crypto.randomUUID(),
      name: '新建舞台方案',
      createdAt: Date.now(),
      stageWidth: 16,
      stageDepth: 12,
      stageHeight: 8,
    },
    lights: [],
    actors: [],
    props: [],
    trajectories: [],
    validationResults: [],
    occlusionResults: [],
    actorLightStatus: [],
    selectedElement: null,
    filters: {
      lights: true,
      actors: true,
      props: true,
      trajectories: true,
      selectedTypes: [],
    },
    playback: {
      isPlaying: false,
      currentTime: 0,
      duration: 60,
      speed: 1,
    },
    importedFiles: [],
  }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...createInitialState(),

  setScene: (scene) => set({ scene }),

  addLights: (lights) =>
    set((state) => ({
      lights: [...state.lights, ...lights],
    })),

  addActors: (actors) =>
    set((state) => ({
      actors: [...state.actors, ...actors],
    })),

  addProps: (props) =>
    set((state) => ({
      props: [...state.props, ...props],
    })),

  addTrajectories: (trajectories) =>
    set((state) => {
      const resolved = trajectories.map((t) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.actorId)
        if (!isUuid) {
          const actor = state.actors.find((a) => a.name === t.actorId)
          if (actor) {
            return { ...t, actorId: actor.id }
          }
        }
        return t
      })

      const maxTime = Math.max(
        ...resolved.flatMap((t) => t.waypoints.map((w) => w.time)),
        state.playback.duration
      )
      return {
        trajectories: [...state.trajectories, ...resolved],
        playback: { ...state.playback, duration: maxTime },
      }
    }),

  setValidationResults: (validationResults) => set({ validationResults }),

  setOcclusionResults: (occlusionResults) => set({ occlusionResults }),

  setActorLightStatus: (actorLightStatus) => set({ actorLightStatus }),

  setSelectedElement: (selectedElement) => set({ selectedElement }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  setPlayback: (playback) =>
    set((state) => ({
      playback: { ...state.playback, ...playback },
    })),

  setCurrentTime: (currentTime) =>
    set((state) => ({
      playback: { ...state.playback, currentTime },
    })),

  togglePlaying: () =>
    set((state) => ({
      playback: { ...state.playback, isPlaying: !state.playback.isPlaying },
    })),

  addImportedFile: (fileName) =>
    set((state) => ({
      importedFiles: [...state.importedFiles, fileName],
    })),

  clearAll: () => {
    const initial = createInitialState()
    set(initial)
    localStorage.removeItem(CURRENT_PROJECT_KEY)
  },

  saveProject: (name, thumbnail) => {
    const state = get()
    const savedProjects = state.getSavedProjects()
    const project: SavedProject = {
      id: crypto.randomUUID(),
      name,
      savedAt: Date.now(),
      state: { ...state, scene: { ...state.scene, name } },
      thumbnail,
    }
    const updated = [...savedProjects, project]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  },

  loadProject: (id) => {
    const savedProjects = get().getSavedProjects()
    const project = savedProjects.find((p) => p.id === id)
    if (project) {
      set(project.state)
      localStorage.setItem(CURRENT_PROJECT_KEY, JSON.stringify(project.state))
    }
  },

  deleteProject: (id) => {
    const savedProjects = get().getSavedProjects()
    const updated = savedProjects.filter((p) => p.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  },

  getSavedProjects: () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  },

  exportProject: () => {
    const state = get()
    return JSON.stringify(state, null, 2)
  },

  importProject: (data) => {
    try {
      const state = JSON.parse(data) as ProjectState
      set(state)
      localStorage.setItem(CURRENT_PROJECT_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('Failed to import project:', e)
    }
  },
}))
