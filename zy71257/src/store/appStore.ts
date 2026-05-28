import { create } from 'zustand';
import { 
  FlightData, 
  Route, 
  Aircraft, 
  FilterState, 
  UserPermission, 
  DataStatus,
  AnomalyType
} from '../types';
import { FLIGHT_DATA, ROUTES, AIRCRAFT, DEFAULT_PERMISSION } from '../data/mockData';
import { createPermissionManager, PermissionManager, formatSensitiveLog } from '../utils/permission';

interface AppStore {
  flightData: FlightData[];
  routes: Route[];
  aircraft: Aircraft[];
  selectedFlightId: string | null;
  filters: FilterState;
  permission: UserPermission;
  permissionManager: PermissionManager;
  currentTimeRange: string;
  isRotating: boolean;
  hoveredFlightId: string | null;
  
  setSelectedFlight: (id: string | null) => void;
  setHoveredFlight: (id: string | null) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setDateRange: (start: string, end: string) => void;
  setStatusFilter: (status: DataStatus | 'all') => void;
  toggleAnomalyFilter: (anomaly: AnomalyType) => void;
  toggleRouteFilter: (routeId: string) => void;
  toggleAircraftTypeFilter: (aircraftModel: string) => void;
  setLoadFactorRange: (min: number, max: number) => void;
  setEmissionRange: (min: number, max: number) => void;
  toggleRotation: () => void;
  setTimeRange: (range: string) => void;
  updatePermission: (permission: Partial<UserPermission>) => void;
  updateFlightFieldStatus: (
    flightId: string, 
    field: keyof FlightData['fieldStatuses'], 
    status: DataStatus
  ) => void;
  getFilteredData: () => FlightData[];
  getSelectedFlight: () => FlightData | null;
  getFlightById: (id: string) => FlightData | null;
  getRouteById: (id: string) => Route | undefined;
  getAircraftById: (id: string) => Aircraft | undefined;
  resetFilters: () => void;
}

const defaultFilters: FilterState = {
  dateRange: { start: '2026-01-01', end: '2026-03-31' },
  routes: [],
  aircraftTypes: [],
  loadFactorRange: { min: 0, max: 100 },
  emissionRange: { min: 0, max: 100000 },
  statusFilter: 'all',
  anomalyFilter: [],
};

export const useAppStore = create<AppStore>((set, get) => ({
  flightData: FLIGHT_DATA,
  routes: ROUTES,
  aircraft: AIRCRAFT,
  selectedFlightId: null,
  filters: defaultFilters,
  permission: DEFAULT_PERMISSION,
  permissionManager: createPermissionManager(DEFAULT_PERMISSION),
  currentTimeRange: 'Q1',
  isRotating: true,
  hoveredFlightId: null,

  setSelectedFlight: (id) => {
    set({ selectedFlightId: id });
    if (id) {
      get().permissionManager.logAction('select_flight', { flightId: id });
    }
  },

  setHoveredFlight: (id) => set({ hoveredFlightId: id }),

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
    get().permissionManager.logAction('update_filters', { 
      field: JSON.stringify(newFilters) 
    });
  },

  setDateRange: (start, end) => {
    set((state) => ({
      filters: { ...state.filters, dateRange: { start, end } },
    }));
  },

  setStatusFilter: (status) => {
    set((state) => ({
      filters: { ...state.filters, statusFilter: status },
    }));
  },

  toggleAnomalyFilter: (anomaly) => {
    set((state) => {
      const current = state.filters.anomalyFilter;
      const next = current.includes(anomaly)
        ? current.filter(a => a !== anomaly)
        : [...current, anomaly];
      return { filters: { ...state.filters, anomalyFilter: next } };
    });
  },

  toggleRouteFilter: (routeId) => {
    set((state) => {
      const current = state.filters.routes;
      const next = current.includes(routeId)
        ? current.filter(r => r !== routeId)
        : [...current, routeId];
      return { filters: { ...state.filters, routes: next } };
    });
  },

  toggleAircraftTypeFilter: (aircraftModel) => {
    set((state) => {
      const current = state.filters.aircraftTypes;
      const next = current.includes(aircraftModel)
        ? current.filter(m => m !== aircraftModel)
        : [...current, aircraftModel];
      return { filters: { ...state.filters, aircraftTypes: next } };
    });
  },

  setLoadFactorRange: (min, max) => {
    set((state) => ({
      filters: { ...state.filters, loadFactorRange: { min, max } },
    }));
  },

  setEmissionRange: (min, max) => {
    set((state) => ({
      filters: { ...state.filters, emissionRange: { min, max } },
    }));
  },

  toggleRotation: () => {
    set((state) => ({ isRotating: !state.isRotating }));
  },

  setTimeRange: (range) => {
    const rangeMap: Record<string, { start: string; end: string }> = {
      'Q1': { start: '2026-01-01', end: '2026-03-31' },
      'Q2': { start: '2026-04-01', end: '2026-06-30' },
      '1月': { start: '2026-01-01', end: '2026-01-31' },
      '2月': { start: '2026-02-01', end: '2026-02-28' },
      '3月': { start: '2026-03-01', end: '2026-03-31' },
    };
    const dates = rangeMap[range] || rangeMap['Q1'];
    set({ 
      currentTimeRange: range,
      filters: { ...get().filters, dateRange: dates } 
    });
    get().permissionManager.logAction('change_time_range', { 
      field: range, 
      newValue: JSON.stringify(dates) 
    });
  },

  updatePermission: (newPermission) => {
    set((state) => {
      const permission = { ...state.permission, ...newPermission };
      const manager = createPermissionManager(permission);
      return { permission, permissionManager: manager };
    });
  },

  updateFlightFieldStatus: (flightId, field, status) => {
    set((state) => ({
      flightData: state.flightData.map(f => {
        if (f.id !== flightId) return f;
        const newFieldStatuses = { ...f.fieldStatuses, [field]: status };
        const hasTentative = Object.values(newFieldStatuses).some(s => s === 'tentative');
        const newStatus: DataStatus = hasTentative ? 'tentative' : 'confirmed';
        
        const { oldValue, newValue } = formatSensitiveLog(
          field, 
          f.fieldStatuses[field], 
          status,
          state.permission.canViewSensitive
        );
        
        state.permissionManager.logAction('update_field_status', {
          flightId,
          field,
          oldValue,
          newValue,
        });
        
        return {
          ...f,
          fieldStatuses: newFieldStatuses,
          status: newStatus,
          anomalies: status === 'confirmed' 
            ? f.anomalies.filter(a => a !== getAnomalyForField(field))
            : f.anomalies,
        };
      }),
    }));
  },

  getFilteredData: () => {
    const state = get();
    const { filters, flightData } = state;
    
    return flightData.filter(f => {
      if (f.date < filters.dateRange.start || f.date > filters.dateRange.end) return false;
      
      if (filters.routes.length > 0 && !filters.routes.includes(f.routeId)) return false;
      
      if (filters.aircraftTypes.length > 0) {
        const aircraft = state.getAircraftById(f.aircraftId);
        if (!aircraft || !filters.aircraftTypes.includes(aircraft.model)) return false;
      }
      
      if (f.loadFactor !== null) {
        if (f.loadFactor < filters.loadFactorRange.min || f.loadFactor > filters.loadFactorRange.max) return false;
      }
      
      if (f.carbonEmission < filters.emissionRange.min || f.carbonEmission > filters.emissionRange.max) return false;
      
      if (filters.statusFilter !== 'all' && f.status !== filters.statusFilter) return false;
      
      if (filters.anomalyFilter.length > 0) {
        const hasAnomaly = filters.anomalyFilter.some(a => f.anomalies.includes(a));
        if (!hasAnomaly) return false;
      }
      
      return true;
    });
  },

  getSelectedFlight: () => {
    const state = get();
    if (!state.selectedFlightId) return null;
    return state.flightData.find(f => f.id === state.selectedFlightId) || null;
  },

  getFlightById: (id) => {
    return get().flightData.find(f => f.id === id) || null;
  },

  getRouteById: (id) => {
    return get().routes.find(r => r.id === id);
  },

  getAircraftById: (id) => {
    return get().aircraft.find(a => a.id === id);
  },

  resetFilters: () => {
    set({ filters: defaultFilters });
  },
}));

function getAnomalyForField(field: string): AnomalyType | null {
  const map: Record<string, AnomalyType> = {
    loadFactor: 'missing_load_factor',
    aircraftType: 'aircraft_mapping_error',
  };
  return map[field] || null;
}
