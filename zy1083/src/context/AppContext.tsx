import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import {
  House,
  VisitNote,
  RatingConfig,
  ShortlistItem,
  FollowUpItem,
  ScoredHouse,
  ProjectData,
  WeightConfig,
} from '../types';
import { DEFAULT_RATING_CONFIG, scoreAllHouses } from '../utils/scoring';

interface AppState {
  houses: House[];
  visitNotes: VisitNote[];
  shortlist: ShortlistItem[];
  ratingConfig: RatingConfig;
  scoredHouses: ScoredHouse[];
  lastUpdated: string;
  isUsingExampleData: boolean;
}

type AppAction =
  | { type: 'SET_HOUSES'; payload: House[] }
  | { type: 'SET_VISIT_NOTES'; payload: VisitNote[] }
  | { type: 'ADD_HOUSE'; payload: House }
  | { type: 'UPDATE_HOUSE'; payload: House }
  | { type: 'DELETE_HOUSE'; payload: string }
  | { type: 'ADD_VISIT_NOTE'; payload: VisitNote }
  | { type: 'UPDATE_VISIT_NOTE'; payload: VisitNote }
  | { type: 'DELETE_VISIT_NOTE'; payload: string }
  | { type: 'ADD_TO_SHORTLIST'; payload: { houseId: string; priority?: '高' | '中' | '低' } }
  | { type: 'REMOVE_FROM_SHORTLIST'; payload: string }
  | { type: 'UPDATE_SHORTLIST_ITEM'; payload: Partial<ShortlistItem> & { houseId: string } }
  | { type: 'ADD_FOLLOW_UP'; payload: FollowUpItem }
  | { type: 'UPDATE_FOLLOW_UP'; payload: FollowUpItem }
  | { type: 'DELETE_FOLLOW_UP'; payload: { houseId: string; followUpId: string } }
  | { type: 'UPDATE_WEIGHTS'; payload: Partial<WeightConfig> }
  | { type: 'RESET_WEIGHTS'; payload?: undefined }
  | { type: 'LOAD_PROJECT'; payload: ProjectData }
  | { type: 'CLEAR_ALL_DATA'; payload?: undefined }
  | { type: 'LOAD_EXAMPLE_DATA'; payload: { houses: House[]; visitNotes: VisitNote[] } }
  | { type: 'UPDATE_SCORED_HOUSES'; payload?: undefined };

const initialState: AppState = {
  houses: [],
  visitNotes: [],
  shortlist: [],
  ratingConfig: DEFAULT_RATING_CONFIG,
  scoredHouses: [],
  lastUpdated: new Date().toISOString(),
  isUsingExampleData: false,
};

const STORAGE_KEY = 'rental-review-platform-data';

const appReducer = (state: AppState, action: AppAction): AppState => {
  let newState: AppState;

  switch (action.type) {
    case 'SET_HOUSES':
      newState = {
        ...state,
        houses: action.payload,
        lastUpdated: new Date().toISOString(),
        isUsingExampleData: false,
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'SET_VISIT_NOTES':
      newState = {
        ...state,
        visitNotes: action.payload,
        lastUpdated: new Date().toISOString(),
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'ADD_HOUSE':
      newState = {
        ...state,
        houses: [...state.houses, action.payload],
        lastUpdated: new Date().toISOString(),
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'UPDATE_HOUSE':
      newState = {
        ...state,
        houses: state.houses.map((h) =>
          h.id === action.payload.id ? action.payload : h
        ),
        lastUpdated: new Date().toISOString(),
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'DELETE_HOUSE':
      newState = {
        ...state,
        houses: state.houses.filter((h) => h.id !== action.payload),
        visitNotes: state.visitNotes.filter((vn) => vn.houseId !== action.payload),
        shortlist: state.shortlist.filter((s) => s.houseId !== action.payload),
        lastUpdated: new Date().toISOString(),
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'ADD_VISIT_NOTE':
      newState = {
        ...state,
        visitNotes: [...state.visitNotes, action.payload],
        lastUpdated: new Date().toISOString(),
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'UPDATE_VISIT_NOTE':
      newState = {
        ...state,
        visitNotes: state.visitNotes.map((vn) =>
          vn.id === action.payload.id ? action.payload : vn
        ),
        lastUpdated: new Date().toISOString(),
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'DELETE_VISIT_NOTE':
      newState = {
        ...state,
        visitNotes: state.visitNotes.filter((vn) => vn.id !== action.payload),
        lastUpdated: new Date().toISOString(),
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'ADD_TO_SHORTLIST': {
      const exists = state.shortlist.some((s) => s.houseId === action.payload.houseId);
      if (exists) return state;

      const newItem: ShortlistItem = {
        houseId: action.payload.houseId,
        addedAt: new Date().toISOString(),
        priority: action.payload.priority || '中',
        notes: '',
        followUps: [],
      };

      newState = {
        ...state,
        shortlist: [...state.shortlist, newItem],
        lastUpdated: new Date().toISOString(),
      };
      return newState;
    }

    case 'REMOVE_FROM_SHORTLIST':
      return {
        ...state,
        shortlist: state.shortlist.filter((s) => s.houseId !== action.payload),
        lastUpdated: new Date().toISOString(),
      };

    case 'UPDATE_SHORTLIST_ITEM':
      return {
        ...state,
        shortlist: state.shortlist.map((s) =>
          s.houseId === action.payload.houseId
            ? { ...s, ...action.payload }
            : s
        ),
        lastUpdated: new Date().toISOString(),
      };

    case 'ADD_FOLLOW_UP':
      return {
        ...state,
        shortlist: state.shortlist.map((s) =>
          s.houseId === action.payload.houseId
            ? { ...s, followUps: [...s.followUps, action.payload] }
            : s
        ),
        lastUpdated: new Date().toISOString(),
      };

    case 'UPDATE_FOLLOW_UP':
      return {
        ...state,
        shortlist: state.shortlist.map((s) =>
          s.houseId === action.payload.houseId
            ? {
                ...s,
                followUps: s.followUps.map((f) =>
                  f.id === action.payload.id ? action.payload : f
                ),
              }
            : s
        ),
        lastUpdated: new Date().toISOString(),
      };

    case 'DELETE_FOLLOW_UP':
      return {
        ...state,
        shortlist: state.shortlist.map((s) =>
          s.houseId === action.payload.houseId
            ? {
                ...s,
                followUps: s.followUps.filter((f) => f.id !== action.payload.followUpId),
              }
            : s
        ),
        lastUpdated: new Date().toISOString(),
      };

    case 'UPDATE_WEIGHTS':
      newState = {
        ...state,
        ratingConfig: {
          ...state.ratingConfig,
          weights: {
            ...state.ratingConfig.weights,
            ...action.payload,
          },
        },
        lastUpdated: new Date().toISOString(),
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'RESET_WEIGHTS':
      newState = {
        ...state,
        ratingConfig: DEFAULT_RATING_CONFIG,
        lastUpdated: new Date().toISOString(),
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'LOAD_PROJECT':
      newState = {
        ...state,
        houses: action.payload.houses || [],
        visitNotes: action.payload.visitNotes || [],
        shortlist: action.payload.shortlist || [],
        ratingConfig: action.payload.ratingConfig || DEFAULT_RATING_CONFIG,
        lastUpdated: action.payload.lastUpdated || new Date().toISOString(),
        isUsingExampleData: false,
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'CLEAR_ALL_DATA':
      return {
        ...initialState,
        scoredHouses: [],
      };

    case 'LOAD_EXAMPLE_DATA':
      newState = {
        ...state,
        houses: action.payload.houses,
        visitNotes: action.payload.visitNotes,
        shortlist: [],
        ratingConfig: DEFAULT_RATING_CONFIG,
        lastUpdated: new Date().toISOString(),
        isUsingExampleData: true,
      };
      newState.scoredHouses = scoreAllHouses(
        newState.houses,
        newState.visitNotes,
        newState.ratingConfig
      );
      return newState;

    case 'UPDATE_SCORED_HOUSES':
      return {
        ...state,
        scoredHouses: scoreAllHouses(
          state.houses,
          state.visitNotes,
          state.ratingConfig
        ),
      };

    default:
      return state;
  }
};

const loadFromLocalStorage = (): AppState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved) as ProjectData;
      const scoredHouses = scoreAllHouses(
        data.houses || [],
        data.visitNotes || [],
        data.ratingConfig || DEFAULT_RATING_CONFIG
      );
      return {
        houses: data.houses || [],
        visitNotes: data.visitNotes || [],
        shortlist: data.shortlist || [],
        ratingConfig: data.ratingConfig || DEFAULT_RATING_CONFIG,
        scoredHouses,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        isUsingExampleData: false,
      };
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
  }
  return null;
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  exportProject: () => ProjectData;
  saveToLocalStorage: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState, (init) => {
    const saved = loadFromLocalStorage();
    return saved || init;
  });

  const exportProject = useCallback((): ProjectData => {
    return {
      houses: state.houses,
      visitNotes: state.visitNotes,
      shortlist: state.shortlist,
      ratingConfig: state.ratingConfig,
      lastUpdated: state.lastUpdated,
    };
  }, [state]);

  const saveToLocalStorage = useCallback(() => {
    try {
      const data: ProjectData = {
        houses: state.houses,
        visitNotes: state.visitNotes,
        shortlist: state.shortlist,
        ratingConfig: state.ratingConfig,
        lastUpdated: state.lastUpdated,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [state]);

  useEffect(() => {
    saveToLocalStorage();
  }, [state.houses, state.visitNotes, state.shortlist, state.ratingConfig, saveToLocalStorage]);

  return (
    <AppContext.Provider value={{ state, dispatch, exportProject, saveToLocalStorage }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const useScoredHouses = () => {
  const { state } = useApp();
  return state.scoredHouses;
};

export const useShortlist = () => {
  const { state, dispatch } = useApp();
  
  const shortlistWithHouses = state.shortlist.map((item) => {
    const house = state.scoredHouses.find((h) => h.id === item.houseId);
    return {
      ...item,
      house,
    };
  });

  const addToShortlist = (houseId: string, priority?: '高' | '中' | '低') => {
    dispatch({ type: 'ADD_TO_SHORTLIST', payload: { houseId, priority } });
  };

  const removeFromShortlist = (houseId: string) => {
    dispatch({ type: 'REMOVE_FROM_SHORTLIST', payload: houseId });
  };

  const updateShortlistItem = (updates: Partial<ShortlistItem> & { houseId: string }) => {
    dispatch({ type: 'UPDATE_SHORTLIST_ITEM', payload: updates });
  };

  return {
    shortlist: shortlistWithHouses,
    addToShortlist,
    removeFromShortlist,
    updateShortlistItem,
  };
};

export const useWeights = () => {
  const { state, dispatch } = useApp();

  const updateWeight = (key: keyof WeightConfig, value: number) => {
    dispatch({ type: 'UPDATE_WEIGHTS', payload: { [key]: value } });
  };

  const resetWeights = () => {
    dispatch({ type: 'RESET_WEIGHTS' });
  };

  return {
    weights: state.ratingConfig.weights,
    updateWeight,
    resetWeights,
  };
};
