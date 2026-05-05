import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type {
  DashboardState,
  DashboardAction,
  Filters,
  SavedFilter,
  DataValidationWarning,
  Event,
  Order,
  Booth,
  Target,
  AggregatedData,
} from '../types';
import { aggregateData, filterAggregatedData, getDistinctValues } from '../utils/dataAggregator';
import { validateOrders, deduplicateOrders } from '../utils/dataParser';

const initialFilters: Filters = {
  hallIds: [],
  boothIds: [],
  timeSlots: [],
  industries: [],
};

const initialState: DashboardState = {
  events: [],
  orders: [],
  booths: [],
  targets: [],
  filters: initialFilters,
  aggregatedData: [],
  filteredData: [],
  savedFilters: [],
  warnings: [],
  isDataLoaded: false,
  selectedBoothId: null,
  selectedHallId: null,
  selectedTimeSlot: null,
};

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_EVENTS':
      return { ...state, events: action.payload };
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'SET_BOOTHS':
      return { ...state, booths: action.payload };
    case 'SET_TARGETS':
      return { ...state, targets: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'RESET_FILTERS':
      return {
        ...state,
        filters: initialFilters,
        selectedBoothId: null,
        selectedHallId: null,
        selectedTimeSlot: null,
      };
    case 'ADD_SAVED_FILTER':
      return { ...state, savedFilters: [...state.savedFilters, action.payload] };
    case 'REMOVE_SAVED_FILTER':
      return {
        ...state,
        savedFilters: state.savedFilters.filter((f) => f.id !== action.payload),
      };
    case 'LOAD_SAVED_FILTER':
      return { ...state, filters: action.payload.filters };
    case 'SET_WARNINGS':
      return { ...state, warnings: action.payload };
    case 'SET_DATA_LOADED':
      return { ...state, isDataLoaded: action.payload };
    case 'SET_SELECTED_BOOTH':
      return { ...state, selectedBoothId: action.payload };
    case 'SET_SELECTED_HALL':
      return { ...state, selectedHallId: action.payload };
    case 'SET_SELECTED_TIME_SLOT':
      return { ...state, selectedTimeSlot: action.payload };
    case 'CLEAR_SELECTIONS':
      return {
        ...state,
        selectedBoothId: null,
        selectedHallId: null,
        selectedTimeSlot: null,
      };
    default:
      return state;
  }
}

interface DashboardContextType extends DashboardState {
  dispatch: React.Dispatch<DashboardAction>;
  loadSampleData: () => Promise<void>;
  loadEventsFromFile: (file: File) => Promise<void>;
  loadOrdersFromFile: (file: File) => Promise<void>;
  loadBoothsFromFile: (file: File) => Promise<void>;
  loadTargetsFromFile: (file: File) => Promise<void>;
  applyFilter: (filter: Partial<Filters>) => void;
  resetFilters: () => void;
  saveCurrentFilter: (name: string) => void;
  loadSavedFilter: (savedFilter: SavedFilter) => void;
  deleteSavedFilter: (id: string) => void;
  selectBooth: (boothId: string | null) => void;
  selectHall: (hallId: string | null) => void;
  selectTimeSlot: (timeSlot: string | null) => void;
  clearSelections: () => void;
  getDistinctOptions: () => ReturnType<typeof getDistinctValues>;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export const useDashboard = (): DashboardContextType => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: React.ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  const computeAndSetAggregatedData = useCallback(
    (events: Event[], orders: Order[], booths: Booth[], targets: Target[], filters: Filters) => {
      const aggregated = aggregateData(events, orders, booths, targets);
      const filtered = filterAggregatedData(aggregated, filters);
      dispatch({ type: 'SET_EVENTS', payload: events });
      dispatch({ type: 'SET_ORDERS', payload: orders });
      dispatch({ type: 'SET_BOOTHS', payload: booths });
      dispatch({ type: 'SET_TARGETS', payload: targets });
    },
    []
  );

  const validateAndSetWarnings = useCallback(
    (events: Event[], orders: Order[], booths: Booth[]) => {
      const warnings: DataValidationWarning[] = [];

      const orderWarning = validateOrders(orders);
      if (orderWarning) {
        warnings.push(orderWarning);
      }

      if (warnings.length > 0) {
        dispatch({ type: 'SET_WARNINGS', payload: warnings });
      }
    },
    []
  );

  const loadSampleData = useCallback(async () => {
    try {
      const [eventsRes, ordersRes, boothsRes, targetsRes] = await Promise.all([
        fetch('/src/data/events.csv'),
        fetch('/src/data/orders.csv'),
        fetch('/src/data/booths.json'),
        fetch('/src/data/targets.csv'),
      ]);

      const eventsText = await eventsRes.text();
      const ordersText = await ordersRes.text();
      const boothsText = await boothsRes.text();
      const targetsText = await targetsRes.text();

      const { parseEvents, parseOrders, parseBooths, parseTargets, readFileAsText } = await import('../utils/dataParser');

      const events = parseEvents(eventsText);
      let orders = parseOrders(ordersText);
      const booths = parseBooths(boothsText);
      const targets = parseTargets(targetsText);

      const uniqueOrders = deduplicateOrders(orders);

      computeAndSetAggregatedData(events, uniqueOrders, booths, targets, state.filters);
      validateAndSetWarnings(events, orders, booths);
      dispatch({ type: 'SET_DATA_LOADED', payload: true });
    } catch (error) {
      console.error('加载示例数据失败:', error);
      throw error;
    }
  }, [computeAndSetAggregatedData, validateAndSetWarnings, state.filters]);

  const loadEventsFromFile = useCallback(
    async (file: File) => {
      const { parseEvents, readFileAsText } = await import('../utils/dataParser');
      const content = await readFileAsText(file);
      const events = parseEvents(content);
      computeAndSetAggregatedData(events, state.orders, state.booths, state.targets, state.filters);
    },
    [computeAndSetAggregatedData, state.orders, state.booths, state.targets, state.filters]
  );

  const loadOrdersFromFile = useCallback(
    async (file: File) => {
      const { parseOrders, readFileAsText } = await import('../utils/dataParser');
      const content = await readFileAsText(file);
      let orders = parseOrders(content);
      const uniqueOrders = deduplicateOrders(orders);
      validateAndSetWarnings(state.events, orders, state.booths);
      computeAndSetAggregatedData(state.events, uniqueOrders, state.booths, state.targets, state.filters);
    },
    [computeAndSetAggregatedData, validateAndSetWarnings, state.events, state.booths, state.targets, state.filters]
  );

  const loadBoothsFromFile = useCallback(
    async (file: File) => {
      const { parseBooths, readFileAsText } = await import('../utils/dataParser');
      const content = await readFileAsText(file);
      const booths = parseBooths(content);
      validateAndSetWarnings(state.events, state.orders, booths);
      computeAndSetAggregatedData(state.events, state.orders, booths, state.targets, state.filters);
    },
    [computeAndSetAggregatedData, validateAndSetWarnings, state.events, state.orders, state.targets, state.filters]
  );

  const loadTargetsFromFile = useCallback(
    async (file: File) => {
      const { parseTargets, readFileAsText } = await import('../utils/dataParser');
      const content = await readFileAsText(file);
      const targets = parseTargets(content);
      computeAndSetAggregatedData(state.events, state.orders, state.booths, targets, state.filters);
    },
    [computeAndSetAggregatedData, state.events, state.orders, state.booths, state.filters]
  );

  const applyFilter = useCallback((filter: Partial<Filters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filter });
  }, []);

  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET_FILTERS' });
  }, []);

  const saveCurrentFilter = useCallback(
    (name: string) => {
      const savedFilter: SavedFilter = {
        id: `filter_${Date.now()}`,
        name,
        filters: { ...state.filters },
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_SAVED_FILTER', payload: savedFilter });
    },
    [state.filters]
  );

  const loadSavedFilter = useCallback((savedFilter: SavedFilter) => {
    dispatch({ type: 'LOAD_SAVED_FILTER', payload: savedFilter });
  }, []);

  const deleteSavedFilter = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_SAVED_FILTER', payload: id });
  }, []);

  const selectBooth = useCallback((boothId: string | null) => {
    dispatch({ type: 'SET_SELECTED_BOOTH', payload: boothId });
    if (boothId) {
      dispatch({ type: 'SET_FILTERS', payload: { boothIds: [boothId] } });
    }
  }, []);

  const selectHall = useCallback((hallId: string | null) => {
    dispatch({ type: 'SET_SELECTED_HALL', payload: hallId });
    if (hallId) {
      dispatch({ type: 'SET_FILTERS', payload: { hallIds: [hallId] } });
    }
  }, []);

  const selectTimeSlot = useCallback((timeSlot: string | null) => {
    dispatch({ type: 'SET_SELECTED_TIME_SLOT', payload: timeSlot });
    if (timeSlot) {
      dispatch({ type: 'SET_FILTERS', payload: { timeSlots: [timeSlot] } });
    }
  }, []);

  const clearSelections = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTIONS' });
    dispatch({ type: 'RESET_FILTERS' });
  }, []);

  const getDistinctOptions = useCallback(() => {
    return getDistinctValues(state.aggregatedData);
  }, [state.aggregatedData]);

  useEffect(() => {
    const aggregated = aggregateData(state.events, state.orders, state.booths, state.targets);
    const filtered = filterAggregatedData(aggregated, state.filters);
  }, [state.events, state.orders, state.booths, state.targets, state.filters]);

  const aggregatedData = aggregateData(state.events, state.orders, state.booths, state.targets);
  const filteredData = filterAggregatedData(aggregatedData, state.filters);

  const value: DashboardContextType = {
    ...state,
    aggregatedData,
    filteredData,
    dispatch,
    loadSampleData,
    loadEventsFromFile,
    loadOrdersFromFile,
    loadBoothsFromFile,
    loadTargetsFromFile,
    applyFilter,
    resetFilters,
    saveCurrentFilter,
    loadSavedFilter,
    deleteSavedFilter,
    selectBooth,
    selectHall,
    selectTimeSlot,
    clearSelections,
    getDistinctOptions,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};
