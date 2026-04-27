import { DesignPlan, DesignStyle, BudgetRange } from '../../data/types';
import { getAllDesignPlans, getDesignPlansByStyle, getDesignPlansByBudgetRange, getRecommendedPlans, getDesignPlanById } from '../../data/mockData';

// Action Types
const FETCH_PLANS_REQUEST = 'FETCH_PLANS_REQUEST';
const FETCH_PLANS_SUCCESS = 'FETCH_PLANS_SUCCESS';
const FETCH_PLANS_FAILURE = 'FETCH_PLANS_FAILURE';
const SET_FILTER_STYLE = 'SET_FILTER_STYLE';
const SET_FILTER_BUDGET = 'SET_FILTER_BUDGET';
const SET_CURRENT_PLAN = 'SET_CURRENT_PLAN';
const INCREMENT_VIEW_COUNT = 'INCREMENT_VIEW_COUNT';
const INCREMENT_LIKE_COUNT = 'INCREMENT_LIKE_COUNT';

// Action Interfaces
interface FetchPlansRequestAction {
  type: typeof FETCH_PLANS_REQUEST;
}

interface FetchPlansSuccessAction {
  type: typeof FETCH_PLANS_SUCCESS;
  payload: DesignPlan[];
}

interface FetchPlansFailureAction {
  type: typeof FETCH_PLANS_FAILURE;
  payload: string;
}

interface SetFilterStyleAction {
  type: typeof SET_FILTER_STYLE;
  payload: DesignStyle | null;
}

interface SetFilterBudgetAction {
  type: typeof SET_FILTER_BUDGET;
  payload: BudgetRange | null;
}

interface SetCurrentPlanAction {
  type: typeof SET_CURRENT_PLAN;
  payload: DesignPlan | null;
}

interface IncrementViewCountAction {
  type: typeof INCREMENT_VIEW_COUNT;
  payload: string;
}

interface IncrementLikeCountAction {
  type: typeof INCREMENT_LIKE_COUNT;
  payload: string;
}

type PlansActionTypes = 
  | FetchPlansRequestAction
  | FetchPlansSuccessAction
  | FetchPlansFailureAction
  | SetFilterStyleAction
  | SetFilterBudgetAction
  | SetCurrentPlanAction
  | IncrementViewCountAction
  | IncrementLikeCountAction;

// State Interface
interface PlansState {
  plans: DesignPlan[];
  filteredPlans: DesignPlan[];
  currentPlan: DesignPlan | null;
  filterStyle: DesignStyle | null;
  filterBudget: BudgetRange | null;
  loading: boolean;
  error: string | null;
}

// Initial State
const initialState: PlansState = {
  plans: [],
  filteredPlans: [],
  currentPlan: null,
  filterStyle: null,
  filterBudget: null,
  loading: false,
  error: null
};

// Reducer
const plansReducer = (
  state: PlansState = initialState,
  action: PlansActionTypes
): PlansState => {
  switch (action.type) {
    case FETCH_PLANS_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
    case FETCH_PLANS_SUCCESS:
      return {
        ...state,
        loading: false,
        plans: action.payload,
        filteredPlans: action.payload
      };
    case FETCH_PLANS_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };
    case SET_FILTER_STYLE:
      return {
        ...state,
        filterStyle: action.payload,
        filteredPlans: applyFilters(state.plans, action.payload, state.filterBudget)
      };
    case SET_FILTER_BUDGET:
      return {
        ...state,
        filterBudget: action.payload,
        filteredPlans: applyFilters(state.plans, state.filterStyle, action.payload)
      };
    case SET_CURRENT_PLAN:
      return {
        ...state,
        currentPlan: action.payload
      };
    case INCREMENT_VIEW_COUNT:
      return {
        ...state,
        plans: state.plans.map(plan => 
          plan.id === action.payload 
            ? { ...plan, viewCount: plan.viewCount + 1 } 
            : plan
        ),
        filteredPlans: state.filteredPlans.map(plan => 
          plan.id === action.payload 
            ? { ...plan, viewCount: plan.viewCount + 1 } 
            : plan
        ),
        currentPlan: state.currentPlan?.id === action.payload
          ? { ...state.currentPlan, viewCount: state.currentPlan.viewCount + 1 }
          : state.currentPlan
      };
    case INCREMENT_LIKE_COUNT:
      return {
        ...state,
        plans: state.plans.map(plan => 
          plan.id === action.payload 
            ? { ...plan, likeCount: plan.likeCount + 1 } 
            : plan
        ),
        filteredPlans: state.filteredPlans.map(plan => 
          plan.id === action.payload 
            ? { ...plan, likeCount: plan.likeCount + 1 } 
            : plan
        ),
        currentPlan: state.currentPlan?.id === action.payload
          ? { ...state.currentPlan, likeCount: state.currentPlan.likeCount + 1 }
          : state.currentPlan
      };
    default:
      return state;
  }
};

// Helper function to apply filters
const applyFilters = (
  plans: DesignPlan[],
  style: DesignStyle | null,
  budget: BudgetRange | null
): DesignPlan[] => {
  let filtered = [...plans];
  
  if (style) {
    filtered = filtered.filter(plan => plan.style === style);
  }
  
  if (budget) {
    filtered = filtered.filter(plan => plan.budgetRange === budget);
  }
  
  return filtered;
};

// Action Creators
export const fetchAllPlans = () => {
  return (dispatch: any) => {
    dispatch({ type: FETCH_PLANS_REQUEST });
    
    try {
      const plans = getAllDesignPlans();
      dispatch({
        type: FETCH_PLANS_SUCCESS,
        payload: plans
      });
    } catch (error) {
      dispatch({
        type: FETCH_PLANS_FAILURE,
        payload: '获取设计方案失败'
      });
    }
  };
};

export const fetchPlansByStyle = (style: DesignStyle) => {
  return (dispatch: any) => {
    dispatch({ type: FETCH_PLANS_REQUEST });
    
    try {
      const plans = getDesignPlansByStyle(style);
      dispatch({
        type: FETCH_PLANS_SUCCESS,
        payload: plans
      });
    } catch (error) {
      dispatch({
        type: FETCH_PLANS_FAILURE,
        payload: '获取设计方案失败'
      });
    }
  };
};

export const fetchPlansByBudget = (budget: BudgetRange) => {
  return (dispatch: any) => {
    dispatch({ type: FETCH_PLANS_REQUEST });
    
    try {
      const plans = getDesignPlansByBudgetRange(budget);
      dispatch({
        type: FETCH_PLANS_SUCCESS,
        payload: plans
      });
    } catch (error) {
      dispatch({
        type: FETCH_PLANS_FAILURE,
        payload: '获取设计方案失败'
      });
    }
  };
};

export const fetchRecommendedPlans = (preferences: any) => {
  return (dispatch: any) => {
    dispatch({ type: FETCH_PLANS_REQUEST });
    
    try {
      const plans = getRecommendedPlans(preferences);
      dispatch({
        type: FETCH_PLANS_SUCCESS,
        payload: plans
      });
    } catch (error) {
      dispatch({
        type: FETCH_PLANS_FAILURE,
        payload: '获取推荐方案失败'
      });
    }
  };
};

export const fetchPlanById = (id: string) => {
  return (dispatch: any) => {
    try {
      const plan = getDesignPlanById(id);
      dispatch({
        type: SET_CURRENT_PLAN,
        payload: plan || null
      });
      
      if (plan) {
        dispatch({
          type: INCREMENT_VIEW_COUNT,
          payload: id
        });
      }
    } catch (error) {
      console.error('获取方案详情失败:', error);
    }
  };
};

export const setFilterStyle = (style: DesignStyle | null) => ({
  type: SET_FILTER_STYLE,
  payload: style
});

export const setFilterBudget = (budget: BudgetRange | null) => ({
  type: SET_FILTER_BUDGET,
  payload: budget
});

export const incrementLikeCount = (planId: string) => ({
  type: INCREMENT_LIKE_COUNT,
  payload: planId
});

export default plansReducer;
