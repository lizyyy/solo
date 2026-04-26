import { DesignPlan } from '../../data/types';
import { getDesignPlanById } from '../../data/mockData';

// Action Types
const ADD_TO_FAVORITES = 'ADD_TO_FAVORITES';
const REMOVE_FROM_FAVORITES = 'REMOVE_FROM_FAVORITES';
const TOGGLE_FAVORITE = 'TOGGLE_FAVORITE';
const UPDATE_FAVORITE_NOTE = 'UPDATE_FAVORITE_NOTE';

// Action Interfaces
interface AddToFavoritesAction {
  type: typeof ADD_TO_FAVORITES;
  payload: {
    plan: DesignPlan;
    note?: string;
  };
}

interface RemoveFromFavoritesAction {
  type: typeof REMOVE_FROM_FAVORITES;
  payload: string;
}

interface ToggleFavoriteAction {
  type: typeof TOGGLE_FAVORITE;
  payload: {
    plan: DesignPlan;
    note?: string;
  };
}

interface UpdateFavoriteNoteAction {
  type: typeof UPDATE_FAVORITE_NOTE;
  payload: {
    planId: string;
    note: string;
  };
}

type FavoritesActionTypes = 
  | AddToFavoritesAction 
  | RemoveFromFavoritesAction 
  | ToggleFavoriteAction
  | UpdateFavoriteNoteAction;

// 收藏项接口
interface FavoriteItem {
  plan: DesignPlan;
  addedAt: number;
  note?: string;
}

// State Interface
interface FavoritesState {
  items: FavoriteItem[];
}

// Initial State
const initialState: FavoritesState = {
  items: []
};

// Reducer
const favoritesReducer = (
  state: FavoritesState = initialState,
  action: FavoritesActionTypes
): FavoritesState => {
  switch (action.type) {
    case ADD_TO_FAVORITES:
      // 检查是否已经存在
      if (state.items.find(item => item.plan.id === action.payload.plan.id)) {
        return state;
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            plan: action.payload.plan,
            addedAt: Date.now(),
            note: action.payload.note
          }
        ]
      };
    case REMOVE_FROM_FAVORITES:
      return {
        ...state,
        items: state.items.filter(item => item.plan.id !== action.payload)
      };
    case TOGGLE_FAVORITE:
      const existingIndex = state.items.findIndex(
        item => item.plan.id === action.payload.plan.id
      );
      
      if (existingIndex >= 0) {
        // 已收藏，移除
        return {
          ...state,
          items: state.items.filter(item => item.plan.id !== action.payload.plan.id)
        };
      } else {
        // 未收藏，添加
        return {
          ...state,
          items: [
            ...state.items,
            {
              plan: action.payload.plan,
              addedAt: Date.now(),
              note: action.payload.note
            }
          ]
        };
      }
    case UPDATE_FAVORITE_NOTE:
      return {
        ...state,
        items: state.items.map(item => 
          item.plan.id === action.payload.planId
            ? { ...item, note: action.payload.note }
            : item
        )
      };
    default:
      return state;
  }
};

// Action Creators
export const addToFavorites = (planId: string, note?: string) => {
  return (dispatch: any) => {
    const plan = getDesignPlanById(planId);
    if (plan) {
      dispatch({
        type: ADD_TO_FAVORITES,
        payload: {
          plan,
          note
        }
      });
    }
  };
};

export const removeFromFavorites = (planId: string) => ({
  type: REMOVE_FROM_FAVORITES,
  payload: planId
});

export const toggleFavorite = (plan: DesignPlan, note?: string) => ({
  type: TOGGLE_FAVORITE,
  payload: {
    plan,
    note
  }
});

export const updateFavoriteNote = (planId: string, note: string) => ({
  type: UPDATE_FAVORITE_NOTE,
  payload: {
    planId,
    note
  }
});

export default favoritesReducer;
