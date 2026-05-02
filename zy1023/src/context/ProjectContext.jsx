import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { saveProject, loadProject } from '../utils/storage'
import { generateMockWaveform } from '../data/mockData'

const ProjectContext = createContext(null)

const initialState = {
  version: '1.0.0',
  audioInfo: null,
  markers: [],
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  playbackRate: 1.0,
  volume: 0.8,
  zoomLevel: 1,
  scrollOffset: 0,
  waveform: [],
  selectedMarker: null,
  filterType: 'ALL',
  sortBy: 'time',
  isLoading: false
}

const ACTION_TYPES = {
  LOAD_PROJECT: 'LOAD_PROJECT',
  SET_AUDIO_INFO: 'SET_AUDIO_INFO',
  SET_MARKERS: 'SET_MARKERS',
  ADD_MARKER: 'ADD_MARKER',
  UPDATE_MARKER: 'UPDATE_MARKER',
  DELETE_MARKER: 'DELETE_MARKER',
  SET_CURRENT_TIME: 'SET_CURRENT_TIME',
  SET_DURATION: 'SET_DURATION',
  SET_PLAYING: 'SET_PLAYING',
  SET_PLAYBACK_RATE: 'SET_PLAYBACK_RATE',
  SET_VOLUME: 'SET_VOLUME',
  SET_ZOOM_LEVEL: 'SET_ZOOM_LEVEL',
  SET_SCROLL_OFFSET: 'SET_SCROLL_OFFSET',
  SET_WAVEFORM: 'SET_WAVEFORM',
  SET_SELECTED_MARKER: 'SET_SELECTED_MARKER',
  SET_FILTER_TYPE: 'SET_FILTER_TYPE',
  SET_SORT_BY: 'SET_SORT_BY',
  RESET_PROJECT: 'RESET_PROJECT',
  INIT_MOCK_DATA: 'INIT_MOCK_DATA'
}

function projectReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.LOAD_PROJECT:
      return {
        ...state,
        ...action.payload,
        isLoading: false
      }
    case ACTION_TYPES.SET_AUDIO_INFO:
      return {
        ...state,
        audioInfo: action.payload,
        duration: action.payload?.duration || 0
      }
    case ACTION_TYPES.SET_MARKERS:
      return {
        ...state,
        markers: action.payload
      }
    case ACTION_TYPES.ADD_MARKER:
      return {
        ...state,
        markers: [...state.markers, action.payload]
      }
    case ACTION_TYPES.UPDATE_MARKER:
      return {
        ...state,
        markers: state.markers.map(m =>
          m.id === action.payload.id ? { ...m, ...action.payload } : m
        )
      }
    case ACTION_TYPES.DELETE_MARKER:
      return {
        ...state,
        markers: state.markers.filter(m => m.id !== action.payload),
        selectedMarker: state.selectedMarker === action.payload ? null : state.selectedMarker
      }
    case ACTION_TYPES.SET_CURRENT_TIME:
      return {
        ...state,
        currentTime: action.payload
      }
    case ACTION_TYPES.SET_DURATION:
      return {
        ...state,
        duration: action.payload
      }
    case ACTION_TYPES.SET_PLAYING:
      return {
        ...state,
        isPlaying: action.payload
      }
    case ACTION_TYPES.SET_PLAYBACK_RATE:
      return {
        ...state,
        playbackRate: action.payload
      }
    case ACTION_TYPES.SET_VOLUME:
      return {
        ...state,
        volume: action.payload
      }
    case ACTION_TYPES.SET_ZOOM_LEVEL:
      return {
        ...state,
        zoomLevel: action.payload
      }
    case ACTION_TYPES.SET_SCROLL_OFFSET:
      return {
        ...state,
        scrollOffset: action.payload
      }
    case ACTION_TYPES.SET_WAVEFORM:
      return {
        ...state,
        waveform: action.payload
      }
    case ACTION_TYPES.SET_SELECTED_MARKER:
      return {
        ...state,
        selectedMarker: action.payload
      }
    case ACTION_TYPES.SET_FILTER_TYPE:
      return {
        ...state,
        filterType: action.payload
      }
    case ACTION_TYPES.SET_SORT_BY:
      return {
        ...state,
        sortBy: action.payload
      }
    case ACTION_TYPES.RESET_PROJECT:
      return {
        ...initialState
      }
    case ACTION_TYPES.INIT_MOCK_DATA:
      return {
        ...state,
        ...action.payload,
        waveform: generateMockWaveform(1000)
      }
    default:
      return state
  }
}

export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(projectReducer, initialState)

  useEffect(() => {
    const savedProject = loadProject()
    if (savedProject) {
      dispatch({
        type: ACTION_TYPES.LOAD_PROJECT,
        payload: savedProject
      })
    }
  }, [])

  useEffect(() => {
    if (state.markers.length > 0 || state.audioInfo) {
      const projectToSave = {
        version: state.version,
        audioInfo: state.audioInfo,
        markers: state.markers,
        settings: {
          zoomLevel: state.zoomLevel,
          playbackRate: state.playbackRate,
          volume: state.volume
        },
        updatedAt: Date.now()
      }
      saveProject(projectToSave)
    }
  }, [state.markers, state.audioInfo, state.zoomLevel, state.playbackRate, state.volume, state.version])

  const addMarker = useCallback((markerData) => {
    const marker = {
      id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      time: markerData.time || state.currentTime,
      type: markerData.type || 'DELETE',
      note: markerData.note || '',
      createdAt: Date.now()
    }
    dispatch({ type: ACTION_TYPES.ADD_MARKER, payload: marker })
    return marker
  }, [state.currentTime])

  const updateMarker = useCallback((markerId, updates) => {
    dispatch({
      type: ACTION_TYPES.UPDATE_MARKER,
      payload: { id: markerId, ...updates }
    })
  }, [])

  const deleteMarker = useCallback((markerId) => {
    dispatch({ type: ACTION_TYPES.DELETE_MARKER, payload: markerId })
  }, [])

  const setAudioInfo = useCallback((audioInfo) => {
    dispatch({ type: ACTION_TYPES.SET_AUDIO_INFO, payload: audioInfo })
    if (audioInfo?.duration) {
      dispatch({ type: ACTION_TYPES.SET_DURATION, payload: audioInfo.duration })
    }
  }, [])

  const resetProject = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESET_PROJECT })
  }, [])

  const initMockData = useCallback((mockData) => {
    dispatch({ type: ACTION_TYPES.INIT_MOCK_DATA, payload: mockData })
  }, [])

  const value = {
    state,
    dispatch,
    actions: {
      addMarker,
      updateMarker,
      deleteMarker,
      setAudioInfo,
      resetProject,
      initMockData
    }
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}
