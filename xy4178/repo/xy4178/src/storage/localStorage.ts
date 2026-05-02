import { SceneState, ReviewComment } from '@/types'

const STORAGE_KEYS = {
  SCENES: 'shipyard_scenes',
  CURRENT_SCENE: 'shipyard_current_scene',
  COMMENTS: 'shipyard_comments',
  SETTINGS: 'shipyard_settings'
}

interface StoredScene {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  sceneData: string
}

interface StoredComment {
  id: string
  sceneId: string
  comment: ReviewComment
}

export const localStorageService = {
  saveScene: (scene: SceneState): void => {
    try {
      const scenes = localStorageService.getStoredScenes()
      const serializedScene = JSON.stringify(scene)
      
      const existingIndex = scenes.findIndex(s => s.id === scene.id)
      const storedScene: StoredScene = {
        id: scene.id,
        name: scene.name,
        createdAt: scene.createdAt.toISOString(),
        updatedAt: scene.updatedAt.toISOString(),
        sceneData: serializedScene
      }

      if (existingIndex >= 0) {
        scenes[existingIndex] = storedScene
      } else {
        scenes.push(storedScene)
      }

      localStorage.setItem(STORAGE_KEYS.SCENES, JSON.stringify(scenes))
    } catch (error) {
      console.error('Failed to save scene to localStorage:', error)
    }
  },

  loadScene: (id: string): SceneState | null => {
    try {
      const scenes = localStorageService.getStoredScenes()
      const storedScene = scenes.find(s => s.id === id)
      
      if (!storedScene) return null
      
      const scene = JSON.parse(storedScene.sceneData)
      return {
        ...scene,
        createdAt: new Date(scene.createdAt),
        updatedAt: new Date(scene.updatedAt)
      }
    } catch (error) {
      console.error('Failed to load scene from localStorage:', error)
      return null
    }
  },

  getStoredScenes: (): StoredScene[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCENES)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Failed to get stored scenes:', error)
      return []
    }
  },

  deleteScene: (id: string): void => {
    try {
      const scenes = localStorageService.getStoredScenes()
      const filteredScenes = scenes.filter(s => s.id !== id)
      localStorage.setItem(STORAGE_KEYS.SCENES, JSON.stringify(filteredScenes))
    } catch (error) {
      console.error('Failed to delete scene from localStorage:', error)
    }
  },

  saveCurrentSceneId: (id: string): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SCENE, id)
    } catch (error) {
      console.error('Failed to save current scene ID:', error)
    }
  },

  getCurrentSceneId: (): string | null => {
    try {
      return localStorage.getItem(STORAGE_KEYS.CURRENT_SCENE)
    } catch (error) {
      console.error('Failed to get current scene ID:', error)
      return null
    }
  },

  saveComment: (sceneId: string, comment: ReviewComment): void => {
    try {
      const comments = localStorageService.getComments(sceneId)
      const existingIndex = comments.findIndex(c => c.id === comment.id)
      
      const storedComment: StoredComment = {
        id: comment.id,
        sceneId,
        comment
      }

      if (existingIndex >= 0) {
        comments[existingIndex] = storedComment
      } else {
        comments.push(storedComment)
      }

      const allComments = localStorageService.getAllStoredComments()
      const filteredComments = allComments.filter(c => c.sceneId !== sceneId)
      localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify([...filteredComments, ...comments]))
    } catch (error) {
      console.error('Failed to save comment:', error)
    }
  },

  getComments: (sceneId: string): StoredComment[] => {
    try {
      const allComments = localStorageService.getAllStoredComments()
      return allComments.filter(c => c.sceneId === sceneId)
    } catch (error) {
      console.error('Failed to get comments:', error)
      return []
    }
  },

  getAllStoredComments: (): StoredComment[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COMMENTS)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Failed to get all stored comments:', error)
      return []
    }
  },

  deleteComment: (id: string): void => {
    try {
      const comments = localStorageService.getAllStoredComments()
      const filteredComments = comments.filter(c => c.id !== id)
      localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(filteredComments))
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  },

  saveSettings: (settings: Record<string, unknown>): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  },

  getSettings: (): Record<string, unknown> => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS)
      return data ? JSON.parse(data) : {}
    } catch (error) {
      console.error('Failed to get settings:', error)
      return {}
    }
  },

  clearAll: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEYS.SCENES)
      localStorage.removeItem(STORAGE_KEYS.CURRENT_SCENE)
      localStorage.removeItem(STORAGE_KEYS.COMMENTS)
      localStorage.removeItem(STORAGE_KEYS.SETTINGS)
    } catch (error) {
      console.error('Failed to clear storage:', error)
    }
  },

  exportSceneToJSON: (scene: SceneState): string => {
    return JSON.stringify({
      ...scene,
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString()
    }, null, 2)
  },

  importSceneFromJSON: (jsonString: string): SceneState | null => {
    try {
      const scene = JSON.parse(jsonString)
      return {
        ...scene,
        createdAt: new Date(scene.createdAt),
        updatedAt: new Date(scene.updatedAt)
      }
    } catch (error) {
      console.error('Failed to parse scene JSON:', error)
      return null
    }
  }
}
