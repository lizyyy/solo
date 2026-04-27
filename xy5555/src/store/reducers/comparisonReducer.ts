import { DesignPlan } from '../../data/types';
import { getDesignPlanById } from '../../data/mockData';

// Action Types
const ADD_TO_COMPARISON = 'ADD_TO_COMPARISON';
const REMOVE_FROM_COMPARISON = 'REMOVE_FROM_COMPARISON';
const CLEAR_COMPARISON = 'CLEAR_COMPARISON';

// Action Interfaces
interface AddToComparisonAction {
  type: typeof ADD_TO_COMPARISON;
  payload: DesignPlan;
}

interface RemoveFromComparisonAction {
  type: typeof REMOVE_FROM_COMPARISON;
  payload: string;
}

interface ClearComparisonAction {
  type: typeof CLEAR_COMPARISON;
}

type ComparisonActionTypes = 
  | AddToComparisonAction 
  | RemoveFromComparisonAction 
  | ClearComparisonAction;

// State Interface
interface ComparisonState {
  items: DesignPlan[];
}

// Initial State
const initialState: ComparisonState = {
  items: []
};

// Reducer
const comparisonReducer = (
  state: ComparisonState = initialState,
  action: ComparisonActionTypes
): ComparisonState => {
  switch (action.type) {
    case ADD_TO_COMPARISON:
      // 检查是否已经存在，并且最多只能对比2个方案
      if (state.items.find(item => item.id === action.payload.id) || state.items.length >= 2) {
        return state;
      }
      return {
        ...state,
        items: [...state.items, action.payload]
      };
    case REMOVE_FROM_COMPARISON:
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };
    case CLEAR_COMPARISON:
      return {
        ...state,
        items: []
      };
    default:
      return state;
  }
};

// Action Creators
export const addToComparison = (planId: string) => {
  return (dispatch: any) => {
    const plan = getDesignPlanById(planId);
    if (plan) {
      dispatch({
        type: ADD_TO_COMPARISON,
        payload: plan
      });
    }
  };
};

export const removeFromComparison = (planId: string) => ({
  type: REMOVE_FROM_COMPARISON,
  payload: planId
});

export const clearComparison = () => ({
  type: CLEAR_COMPARISON
});

export default comparisonReducer;
