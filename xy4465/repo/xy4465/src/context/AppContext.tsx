import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { 
  AppData, 
  Route, 
  MemberFlow, 
  Ascent, 
  IncidentNote, 
  CoachNote, 
  GradeOverride, 
  Alert,
  FilterOptions,
  RouteStats,
  ImportResult,
  ExportOptions
} from '../types';
import { saveAppData, loadAppData, getInitialAppData } from '../services/storageService';
import { processAllRoutes, generateAlerts, filterRoutes, sortRoutes } from '../services/dataProcessor';
import { downloadMarkdownReport, downloadJSONExport } from '../services/exportService';
import { generateId } from '../services/importService';

interface AppState {
  data: AppData;
  statsMap: Map<string, RouteStats>;
  filters: FilterOptions;
  selectedRouteId: string | null;
  importResults: ImportResult[];
  isLoading: boolean;
  error: string | null;
}

type AppAction = 
  | { type: 'SET_DATA'; payload: AppData }
  | { type: 'SET_ROUTES'; payload: Route[] }
  | { type: 'SET_MEMBER_FLOWS'; payload: MemberFlow[] }
  | { type: 'SET_ASCENTS'; payload: Ascent[] }
  | { type: 'SET_INCIDENT_NOTES'; payload: IncidentNote[] }
  | { type: 'ADD_COACH_NOTE'; payload: CoachNote }
  | { type: 'UPDATE_COACH_NOTE'; payload: CoachNote }
  | { type: 'DELETE_COACH_NOTE'; payload: string }
  | { type: 'ADD_GRADE_OVERRIDE'; payload: GradeOverride }
  | { type: 'UPDATE_GRADE_OVERRIDE'; payload: GradeOverride }
  | { type: 'ACKNOWLEDGE_ALERT'; payload: string }
  | { type: 'SET_FILTERS'; payload: Partial<FilterOptions> }
  | { type: 'SELECT_ROUTE'; payload: string | null }
  | { type: 'ADD_IMPORT_RESULT'; payload: ImportResult }
  | { type: 'CLEAR_IMPORT_RESULTS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_DATA' }
  | { type: 'UPDATE_STATS' };

const initialFilters: FilterOptions = {
  difficulties: [],
  zones: [],
  dateRange: {
    start: '',
    end: ''
  },
  searchText: '',
  sortBy: 'name',
  sortOrder: 'asc'
};

const getInitialState = (): AppState => {
  const savedData = loadAppData();
  const data = savedData || getInitialAppData();
  const statsMap = processAllRoutes(data);
  
  return {
    data,
    statsMap,
    filters: initialFilters,
    selectedRouteId: null,
    importResults: [],
    isLoading: false,
    error: null
  };
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_DATA': {
      const statsMap = processAllRoutes(action.payload);
      const alerts = generateAlerts(action.payload);
      const updatedData = { ...action.payload, alerts };
      saveAppData(updatedData);
      return { ...state, data: updatedData, statsMap };
    }
    
    case 'SET_ROUTES': {
      const updatedData = { ...state.data, routes: action.payload };
      const statsMap = processAllRoutes(updatedData);
      const alerts = generateAlerts(updatedData);
      updatedData.alerts = alerts;
      saveAppData(updatedData);
      return { ...state, data: updatedData, statsMap };
    }
    
    case 'SET_MEMBER_FLOWS': {
      const updatedData = { ...state.data, memberFlows: action.payload };
      const statsMap = processAllRoutes(updatedData);
      const alerts = generateAlerts(updatedData);
      updatedData.alerts = alerts;
      saveAppData(updatedData);
      return { ...state, data: updatedData, statsMap };
    }
    
    case 'SET_ASCENTS': {
      const updatedData = { ...state.data, ascents: action.payload };
      const statsMap = processAllRoutes(updatedData);
      const alerts = generateAlerts(updatedData);
      updatedData.alerts = alerts;
      saveAppData(updatedData);
      return { ...state, data: updatedData, statsMap };
    }
    
    case 'SET_INCIDENT_NOTES': {
      const updatedData = { ...state.data, incidentNotes: action.payload };
      const alerts = generateAlerts(updatedData);
      updatedData.alerts = alerts;
      saveAppData(updatedData);
      return { ...state, data: updatedData };
    }
    
    case 'ADD_COACH_NOTE': {
      const updatedNotes = [...state.data.coachNotes, action.payload];
      const updatedData = { ...state.data, coachNotes: updatedNotes };
      saveAppData(updatedData);
      return { ...state, data: updatedData };
    }
    
    case 'UPDATE_COACH_NOTE': {
      const updatedNotes = state.data.coachNotes.map(note =>
        note.id === action.payload.id ? action.payload : note
      );
      const updatedData = { ...state.data, coachNotes: updatedNotes };
      saveAppData(updatedData);
      return { ...state, data: updatedData };
    }
    
    case 'DELETE_COACH_NOTE': {
      const updatedNotes = state.data.coachNotes.filter(note => note.id !== action.payload);
      const updatedData = { ...state.data, coachNotes: updatedNotes };
      saveAppData(updatedData);
      return { ...state, data: updatedData };
    }
    
    case 'ADD_GRADE_OVERRIDE': {
      const updatedOverrides = [...state.data.gradeOverrides, action.payload];
      const updatedData = { ...state.data, gradeOverrides: updatedOverrides };
      saveAppData(updatedData);
      return { ...state, data: updatedData };
    }
    
    case 'UPDATE_GRADE_OVERRIDE': {
      const updatedOverrides = state.data.gradeOverrides.map(override =>
        override.id === action.payload.id ? action.payload : override
      );
      const updatedData = { ...state.data, gradeOverrides: updatedOverrides };
      saveAppData(updatedData);
      return { ...state, data: updatedData };
    }
    
    case 'ACKNOWLEDGE_ALERT': {
      const updatedAlerts = state.data.alerts.map(alert =>
        alert.id === action.payload ? { ...alert, acknowledged: true } : alert
      );
      const updatedData = { ...state.data, alerts: updatedAlerts };
      saveAppData(updatedData);
      return { ...state, data: updatedData };
    }
    
    case 'SET_FILTERS': {
      return { ...state, filters: { ...state.filters, ...action.payload } };
    }
    
    case 'SELECT_ROUTE': {
      return { ...state, selectedRouteId: action.payload };
    }
    
    case 'ADD_IMPORT_RESULT': {
      return { ...state, importResults: [...state.importResults, action.payload] };
    }
    
    case 'CLEAR_IMPORT_RESULTS': {
      return { ...state, importResults: [] };
    }
    
    case 'SET_LOADING': {
      return { ...state, isLoading: action.payload };
    }
    
    case 'SET_ERROR': {
      return { ...state, error: action.payload };
    }
    
    case 'RESET_DATA': {
      const initialData = getInitialAppData();
      saveAppData(initialData);
      return {
        ...state,
        data: initialData,
        statsMap: new Map(),
        selectedRouteId: null,
        importResults: []
      };
    }
    
    case 'UPDATE_STATS': {
      const statsMap = processAllRoutes(state.data);
      return { ...state, statsMap };
    }
    
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  filteredAndSortedRoutes: Route[];
  addCoachNote: (routeId: string, content: string, category: CoachNote['category'], coachName: string) => void;
  addGradeOverride: (routeId: string, originalGrade: string, newGrade: string, reason: string, coachName: string) => void;
  acknowledgeAlert: (alertId: string) => void;
  resetAllData: () => void;
  exportMarkdownReport: (options?: Partial<ExportOptions>) => void;
  exportJSON: (options?: Partial<ExportOptions>) => void;
  getRouteStats: (routeId: string) => RouteStats | undefined;
  getRouteAlerts: (routeId: string) => Alert[];
  getRouteCoachNotes: (routeId: string) => CoachNote[];
  getRouteGradeOverrides: (routeId: string) => GradeOverride[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, undefined, getInitialState);

  useEffect(() => {
    saveAppData(state.data);
  }, [state.data]);

  const filteredAndSortedRoutes = sortRoutes(
    filterRoutes(
      state.data.routes,
      {
        difficulties: state.filters.difficulties,
        zones: state.filters.zones,
        searchText: state.filters.searchText
      }
    ),
    state.statsMap,
    state.filters.sortBy,
    state.filters.sortOrder
  );

  const addCoachNote = (routeId: string, content: string, category: CoachNote['category'], coachName: string) => {
    const note: CoachNote = {
      id: generateId(),
      routeId,
      coachName,
      timestamp: new Date().toISOString(),
      content,
      category
    };
    dispatch({ type: 'ADD_COACH_NOTE', payload: note });
  };

  const addGradeOverride = (routeId: string, originalGrade: string, newGrade: string, reason: string, coachName: string) => {
    const override: GradeOverride = {
      id: generateId(),
      routeId,
      originalGrade,
      newGrade,
      reason,
      coachName,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    dispatch({ type: 'ADD_GRADE_OVERRIDE', payload: override });
  };

  const acknowledgeAlert = (alertId: string) => {
    dispatch({ type: 'ACKNOWLEDGE_ALERT', payload: alertId });
  };

  const resetAllData = () => {
    dispatch({ type: 'RESET_DATA' });
  };

  const exportMarkdownReport = (options?: Partial<ExportOptions>) => {
    const defaultOptions: ExportOptions = {
      includeRoutes: true,
      includeStats: true,
      includeNotes: true,
      includeAlerts: true
    };
    downloadMarkdownReport(state.data, { ...defaultOptions, ...options });
  };

  const exportJSON = (options?: Partial<ExportOptions>) => {
    const defaultOptions: ExportOptions = {
      includeRoutes: true,
      includeStats: true,
      includeNotes: true,
      includeAlerts: true
    };
    downloadJSONExport(state.data, { ...defaultOptions, ...options });
  };

  const getRouteStats = (routeId: string): RouteStats | undefined => {
    return state.statsMap.get(routeId);
  };

  const getRouteAlerts = (routeId: string): Alert[] => {
    return state.data.alerts.filter(alert => alert.routeId === routeId);
  };

  const getRouteCoachNotes = (routeId: string): CoachNote[] => {
    return state.data.coachNotes.filter(note => note.routeId === routeId);
  };

  const getRouteGradeOverrides = (routeId: string): GradeOverride[] => {
    return state.data.gradeOverrides.filter(override => override.routeId === routeId);
  };

  const value: AppContextType = {
    state,
    dispatch,
    filteredAndSortedRoutes,
    addCoachNote,
    addGradeOverride,
    acknowledgeAlert,
    resetAllData,
    exportMarkdownReport,
    exportJSON,
    getRouteStats,
    getRouteAlerts,
    getRouteCoachNotes,
    getRouteGradeOverrides
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
