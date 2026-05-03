import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  ProjectData,
  WallConfig,
  Route,
  Hold,
  UserProfile,
  ViewMode,
  HoldShape,
  HoldSize,
  DifficultyLevel,
} from '../types';
import { getInitialData, saveData } from '../utils/localStorage';

type Action =
  | { type: 'SET_ACTIVE_WALL'; payload: string }
  | { type: 'SET_ACTIVE_ROUTE'; payload: string | null }
  | { type: 'ADD_WALL'; payload: WallConfig }
  | { type: 'UPDATE_WALL'; payload: WallConfig }
  | { type: 'DELETE_WALL'; payload: string }
  | { type: 'ADD_ROUTE'; payload: Route }
  | { type: 'UPDATE_ROUTE'; payload: Route }
  | { type: 'DELETE_ROUTE'; payload: string }
  | { type: 'ADD_HOLD'; payload: { routeId: string; hold: Hold } }
  | { type: 'UPDATE_HOLD'; payload: { routeId: string; holdId: string; updates: Partial<Hold> } }
  | { type: 'DELETE_HOLD'; payload: { routeId: string; holdId: string } }
  | { type: 'UPDATE_USER_PROFILE'; payload: Partial<UserProfile> }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'IMPORT_DATA'; payload: ProjectData }
  | { type: 'RESET_TO_SAMPLE'; payload: ProjectData };

interface AppContextType {
  state: ProjectData;
  activeWall: WallConfig | null;
  activeRoute: Route | null;
  wallRoutes: Route[];
  dispatch: React.Dispatch<Action>;
  createNewRoute: (wallId: string, color?: string) => Route;
  createNewHold: (routeId: string, shape: HoldShape, size: HoldSize, color: string, position: { x: number; y: number }) => Hold;
}

const AppContext = createContext<AppContextType | null>(null);

function reducer(state: ProjectData, action: Action): ProjectData {
  switch (action.type) {
    case 'SET_ACTIVE_WALL':
      return { ...state, activeWallId: action.payload };

    case 'SET_ACTIVE_ROUTE':
      return { ...state, activeRouteId: action.payload };

    case 'ADD_WALL': {
      const newWalls = [...state.walls, action.payload];
      return {
        ...state,
        walls: newWalls,
        activeWallId: action.payload.id,
      };
    }

    case 'UPDATE_WALL': {
      const updatedAt = Date.now();
      return {
        ...state,
        walls: state.walls.map(w =>
          w.id === action.payload.id ? { ...action.payload, updatedAt } : w
        ),
      };
    }

    case 'DELETE_WALL': {
      const remainingWalls = state.walls.filter(w => w.id !== action.payload);
      const remainingRoutes = state.routes.filter(r => r.wallId !== action.payload);
      const newActiveWallId = state.activeWallId === action.payload
        ? remainingWalls[0]?.id || null
        : state.activeWallId;
      const newActiveRouteId = state.activeRouteId
        ? remainingRoutes.find(r => r.id === state.activeRouteId)?.id || null
        : null;

      return {
        ...state,
        walls: remainingWalls,
        routes: remainingRoutes,
        activeWallId: newActiveWallId,
        activeRouteId: newActiveRouteId,
      };
    }

    case 'ADD_ROUTE': {
      return {
        ...state,
        routes: [...state.routes, action.payload],
        activeRouteId: action.payload.id,
      };
    }

    case 'UPDATE_ROUTE': {
      const updatedAt = Date.now();
      return {
        ...state,
        routes: state.routes.map(r =>
          r.id === action.payload.id ? { ...action.payload, updatedAt } : r
        ),
      };
    }

    case 'DELETE_ROUTE': {
      const remainingRoutes = state.routes.filter(r => r.id !== action.payload);
      const newActiveRouteId = state.activeRouteId === action.payload
        ? remainingRoutes[0]?.id || null
        : state.activeRouteId;

      return {
        ...state,
        routes: remainingRoutes,
        activeRouteId: newActiveRouteId,
      };
    }

    case 'ADD_HOLD': {
      return {
        ...state,
        routes: state.routes.map(r =>
          r.id === action.payload.routeId
            ? { ...r, holds: [...r.holds, action.payload.hold] }
            : r
        ),
      };
    }

    case 'UPDATE_HOLD': {
      return {
        ...state,
        routes: state.routes.map(route =>
          route.id === action.payload.routeId
            ? {
                ...route,
                holds: route.holds.map(hold =>
                  hold.id === action.payload.holdId
                    ? { ...hold, ...action.payload.updates }
                    : hold
                ),
              }
            : route
        ),
      };
    }

    case 'DELETE_HOLD': {
      return {
        ...state,
        routes: state.routes.map(route =>
          route.id === action.payload.routeId
            ? {
                ...route,
                holds: route.holds.filter(h => h.id !== action.payload.holdId),
              }
            : route
        ),
      };
    }

    case 'UPDATE_USER_PROFILE': {
      return {
        ...state,
        userProfile: { ...state.userProfile, ...action.payload },
      };
    }

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };

    case 'IMPORT_DATA':
      return action.payload;

    case 'RESET_TO_SAMPLE':
      return action.payload;

    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialData);

  useEffect(() => {
    saveData(state);
  }, [state]);

  const activeWall = state.walls.find(w => w.id === state.activeWallId) || null;
  const activeRoute = state.routes.find(r => r.id === state.activeRouteId) || null;
  const wallRoutes = state.routes.filter(r => r.wallId === state.activeWallId);

  const createNewRoute = (wallId: string, color?: string): Route => {
    const colors = [
      '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
      '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
    ];
    
    const usedColors = wallRoutes.map(r => r.color);
    const availableColors = colors.filter(c => !usedColors.includes(c));
    const routeColor = color || availableColors[0] || colors[0];

    const route: Route = {
      id: uuidv4(),
      wallId,
      name: `新线路 ${wallRoutes.length + 1}`,
      color: routeColor,
      difficulty: 'intermediate',
      estimatedGrade: '',
      holds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    dispatch({ type: 'ADD_ROUTE', payload: route });
    return route;
  };

  const createNewHold = (
    routeId: string,
    shape: HoldShape,
    size: HoldSize,
    color: string,
    position: { x: number; y: number }
  ): Hold => {
    const route = state.routes.find(r => r.id === routeId);
    const maxOrder = route ? Math.max(-1, ...route.holds.map(h => h.order)) : -1;

    const hold: Hold = {
      id: uuidv4(),
      routeId,
      shape,
      size,
      color,
      position: { ...position },
      rotation: 0,
      isStart: false,
      isEnd: false,
      order: maxOrder + 1,
    };

    dispatch({
      type: 'ADD_HOLD',
      payload: { routeId, hold },
    });

    return hold;
  };

  const value: AppContextType = {
    state,
    activeWall,
    activeRoute,
    wallRoutes,
    dispatch,
    createNewRoute,
    createNewHold,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
