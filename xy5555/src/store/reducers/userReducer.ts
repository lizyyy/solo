import { User, UserPreferences, DesignStyle, BudgetRange, SpaceType } from '../../data/types';
import { mockUser } from '../../data/mockData';

// Action Types
const SET_USER = 'SET_USER';
const UPDATE_PREFERENCES = 'UPDATE_PREFERENCES';
const CLEAR_USER = 'CLEAR_USER';

// Action Interfaces
interface SetUserAction {
  type: typeof SET_USER;
  payload: User;
}

interface UpdatePreferencesAction {
  type: typeof UPDATE_PREFERENCES;
  payload: Partial<UserPreferences>;
}

interface ClearUserAction {
  type: typeof CLEAR_USER;
}

type UserActionTypes = SetUserAction | UpdatePreferencesAction | ClearUserAction;

// State Interface
interface UserState {
  user: User | null;
  loading: boolean;
}

// Initial State
const initialState: UserState = {
  user: mockUser,
  loading: false
};

// Reducer
const userReducer = (
  state: UserState = initialState,
  action: UserActionTypes
): UserState => {
  switch (action.type) {
    case SET_USER:
      return {
        ...state,
        user: action.payload
      };
    case UPDATE_PREFERENCES:
      if (!state.user) return state;
      return {
        ...state,
        user: {
          ...state.user,
          preferences: {
            ...state.user.preferences,
            ...action.payload,
            updatedAt: Date.now()
          }
        }
      };
    case CLEAR_USER:
      return {
        ...state,
        user: null
      };
    default:
      return state;
  }
};

// Action Creators
export const setUser = (user: User) => ({
  type: SET_USER,
  payload: user
});

export const updatePreferences = (preferences: Partial<UserPreferences>) => ({
  type: UPDATE_PREFERENCES,
  payload: preferences
});

export const clearUser = () => ({
  type: CLEAR_USER
});

export default userReducer;
