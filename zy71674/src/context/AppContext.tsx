import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type {
  Member,
  LeaveRequest,
  AppState,
} from '../types';
import { sampleMembers, sampleLeaveRequests } from '../data/sampleData';
import {
  generateId,
  generateSubstituteRecommendations,
  createStandingVersion,
  generateReport,
  detectConflicts,
} from '../utils/core';

type AppAction =
  | { type: 'ADD_LEAVE_REQUEST'; payload: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'version'> }
  | { type: 'UPDATE_LEAVE_REQUEST'; payload: { id: string; updates: Partial<LeaveRequest> } }
  | { type: 'DELETE_LEAVE_REQUEST'; payload: string }
  | { type: 'APPROVE_LEAVE_REQUEST'; payload: string }
  | { type: 'REJECT_LEAVE_REQUEST'; payload: { id: string; reason: string } }
  | { type: 'REQUEST_MORE_INFO'; payload: { id: string; reason: string } }
  | { type: 'RESUBMIT_LEAVE_REQUEST'; payload: { id: string; updates: Partial<LeaveRequest> } }
  | { type: 'GENERATE_SUBSTITUTE_RECOMMENDATIONS'; payload: string }
  | { type: 'SELECT_SUBSTITUTE'; payload: string }
  | { type: 'REJECT_SUBSTITUTE'; payload: string }
  | { type: 'CREATE_STANDING_VERSION'; payload: { name: string; date: string } }
  | { type: 'SET_ACTIVE_STANDING_VERSION'; payload: string }
  | { type: 'GENERATE_REPORT'; payload: { date: string; standingVersionId: string } }
  | { type: 'EXPORT_REPORT'; payload: string }
  | { type: 'ADD_MEMBER'; payload: Member }
  | { type: 'UPDATE_MEMBER'; payload: Member }
  | { type: 'DELETE_MEMBER'; payload: string };

const initialState: AppState = {
  members: sampleMembers,
  leaveRequests: sampleLeaveRequests,
  substituteRecommendations: [],
  standingVersions: [],
  reports: [],
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_LEAVE_REQUEST': {
      const newLeave: LeaveRequest = {
        ...action.payload,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      return { ...state, leaveRequests: [...state.leaveRequests, newLeave] };
    }

    case 'UPDATE_LEAVE_REQUEST': {
      return {
        ...state,
        leaveRequests: state.leaveRequests.map((lr) =>
          lr.id === action.payload.id
            ? { ...lr, ...action.payload.updates, updatedAt: new Date().toISOString() }
            : lr
        ),
      };
    }

    case 'DELETE_LEAVE_REQUEST': {
      return {
        ...state,
        leaveRequests: state.leaveRequests.filter((lr) => lr.id !== action.payload),
      };
    }

    case 'APPROVE_LEAVE_REQUEST': {
      return {
        ...state,
        leaveRequests: state.leaveRequests.map((lr) =>
          lr.id === action.payload
            ? { ...lr, status: 'approved', updatedAt: new Date().toISOString() }
            : lr
        ),
      };
    }

    case 'REJECT_LEAVE_REQUEST': {
      return {
        ...state,
        leaveRequests: state.leaveRequests.map((lr) =>
          lr.id === action.payload.id
            ? { ...lr, status: 'rejected', rejectionReason: action.payload.reason, updatedAt: new Date().toISOString() }
            : lr
        ),
      };
    }

    case 'REQUEST_MORE_INFO': {
      return {
        ...state,
        leaveRequests: state.leaveRequests.map((lr) =>
          lr.id === action.payload.id
            ? { ...lr, status: 'needs_more_info', rejectionReason: action.payload.reason, updatedAt: new Date().toISOString() }
            : lr
        ),
      };
    }

    case 'RESUBMIT_LEAVE_REQUEST': {
      return {
        ...state,
        leaveRequests: state.leaveRequests.map((lr) =>
          lr.id === action.payload.id
            ? {
                ...lr,
                ...action.payload.updates,
                status: 'pending',
                version: lr.version + 1,
                updatedAt: new Date().toISOString(),
              }
            : lr
        ),
      };
    }

    case 'GENERATE_SUBSTITUTE_RECOMMENDATIONS': {
      const recommendations = generateSubstituteRecommendations(
        state.members,
        state.leaveRequests,
        action.payload
      );
      const existingIds = new Set(state.substituteRecommendations.map(r => r.leaveRequestId));
      const newRecommendations = recommendations.filter(r => !existingIds.has(r.leaveRequestId));
      return {
        ...state,
        substituteRecommendations: [...state.substituteRecommendations, ...newRecommendations],
      };
    }

    case 'SELECT_SUBSTITUTE': {
      const recommendation = state.substituteRecommendations.find(r => r.id === action.payload);
      if (!recommendation) return state;
      
      return {
        ...state,
        substituteRecommendations: state.substituteRecommendations.map((r) =>
          r.leaveRequestId === recommendation.leaveRequestId
            ? { ...r, status: r.id === action.payload ? 'selected' : 'rejected' }
            : r
        ),
      };
    }

    case 'REJECT_SUBSTITUTE': {
      return {
        ...state,
        substituteRecommendations: state.substituteRecommendations.map((r) =>
          r.id === action.payload ? { ...r, status: 'rejected' }
            : r
        ),
      };
    }

    case 'CREATE_STANDING_VERSION': {
      const newVersion = createStandingVersion(
        action.payload.name,
        action.payload.date,
        state.members,
        state.leaveRequests,
        state.substituteRecommendations
      );
      return {
        ...state,
        standingVersions: [...state.standingVersions.map(v => ({ ...v, isActive: false })), newVersion],
      };
    }

    case 'SET_ACTIVE_STANDING_VERSION': {
      return {
        ...state,
        standingVersions: state.standingVersions.map((v) =>
          v.id === action.payload ? { ...v, isActive: true } : { ...v, isActive: false }
        ),
      };
    }

    case 'GENERATE_REPORT': {
      const standingVersion = state.standingVersions.find(v => v.id === action.payload.standingVersionId);
      if (!standingVersion) return state;
      
      const report = generateReport(
        state.members,
        state.leaveRequests,
        state.substituteRecommendations,
        standingVersion,
        action.payload.date
      );
      return {
        ...state,
        reports: [...state.reports, report],
      };
    }

    case 'ADD_MEMBER': {
      return {
        ...state,
        members: [...state.members, action.payload],
      };
    }

    case 'UPDATE_MEMBER': {
      return {
        ...state,
        members: state.members.map((m) =>
          m.id === action.payload.id ? action.payload : m
        ),
      };
    }

    case 'DELETE_MEMBER': {
      return {
        ...state,
        members: state.members.filter((m) => m.id !== action.payload),
      };
    }

    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  getConflicts: () => ReturnType<typeof detectConflicts>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const getConflicts = () => {
    const activeVersion = state.standingVersions.find(v => v.isActive) || null;
    return detectConflicts(
      state.members,
      state.leaveRequests,
      state.substituteRecommendations,
      activeVersion
    );
  };

  return (
    <AppContext.Provider value={{ state, dispatch, getConflicts }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
