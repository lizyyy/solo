import React, { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type {
  AppState,
  Booking,
  Lane,
  TimeSlot,
} from './types';
import {
  generateId,
  formatTime,
  sampleLanes,
  sampleTimeSlots,
  sampleSmoothBookings,
  sampleConflictBookings,
  createHistoryRecord,
  detectConflicts,
} from './utils';

// Action Types
type Action =
  | { type: 'SET_SELECTED_DATE'; payload: string }
  | { type: 'ADD_BOOKING'; payload: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_BOOKING'; payload: { id: string; updates: Partial<Booking> } }
  | { type: 'DELETE_BOOKING'; payload: string }
  | { type: 'MOVE_BOOKING'; payload: { id: string; laneId: string; timeSlotId: string } }
  | { type: 'LOAD_SMOOTH_SAMPLE' }
  | { type: 'LOAD_CONFLICT_SAMPLE' }
  | { type: 'CLEAR_ALL' }
  | { type: 'CHECK_CONFLICTS' }
  | { type: 'RESOLVE_CONFLICT'; payload: string }
  | { type: 'ADD_LANE'; payload: Omit<Lane, 'id'> }
  | { type: 'UPDATE_LANE'; payload: { id: string; updates: Partial<Lane> } }
  | { type: 'DELETE_LANE'; payload: string }
  | { type: 'ADD_TIMESLOT'; payload: Omit<TimeSlot, 'id'> }
  | { type: 'UPDATE_TIMESLOT'; payload: { id: string; updates: Partial<TimeSlot> } }
  | { type: 'DELETE_TIMESLOT'; payload: string };

// Initial State
const initialState: AppState = {
  lanes: sampleLanes,
  timeSlots: sampleTimeSlots,
  bookings: [],
  conflicts: [],
  history: [],
  selectedDate: new Date().toISOString().split('T')[0],
};

// Reducer
function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SELECTED_DATE':
      return { ...state, selectedDate: action.payload };

    case 'ADD_BOOKING': {
      const newBooking: Booking = {
        ...action.payload,
        id: generateId(),
        createdAt: formatTime(new Date()),
        updatedAt: formatTime(new Date()),
      } as Booking;

      const newBookings = [...state.bookings, newBooking];
      const newConflicts = detectConflicts(newBookings, state.lanes, state.timeSlots);
      
      const historyItem = createHistoryRecord(
        'create',
        'booking',
        newBooking.id,
        `创建新预约`
      );

      return {
        ...state,
        bookings: newBookings,
        conflicts: newConflicts,
        history: [historyItem, ...state.history].slice(0, 50),
      };
    }

    case 'UPDATE_BOOKING': {
      const booking = state.bookings.find((b) => b.id === action.payload.id);
      if (!booking) return state;

      const updatedBookings = state.bookings.map((b) =>
        b.id === action.payload.id
          ? ({ ...b, ...action.payload.updates, updatedAt: formatTime(new Date()) } as Booking)
          : b
      );
      const newConflicts = detectConflicts(updatedBookings, state.lanes, state.timeSlots);

      const historyItem = createHistoryRecord(
        'update',
        'booking',
        action.payload.id,
        `更新预约信息`
      );

      return {
        ...state,
        bookings: updatedBookings,
        conflicts: newConflicts,
        history: [historyItem, ...state.history].slice(0, 50),
      };
    }

    case 'DELETE_BOOKING': {
      const booking = state.bookings.find((b) => b.id === action.payload);
      if (!booking) return state;

      const remainingBookings = state.bookings.filter((b) => b.id !== action.payload);
      const remainingConflicts = state.conflicts.filter(
        (c) => c.bookingId1 !== action.payload && c.bookingId2 !== action.payload
      );

      const historyItem = createHistoryRecord(
        'delete',
        'booking',
        action.payload,
        `删除预约`
      );

      return {
        ...state,
        bookings: remainingBookings,
        conflicts: remainingConflicts,
        history: [historyItem, ...state.history].slice(0, 50),
      };
    }

    case 'MOVE_BOOKING': {
      const booking = state.bookings.find((b) => b.id === action.payload.id);
      if (!booking) return state;

      const oldLane = state.lanes.find((l) => l.id === booking.laneId);
      const newLane = state.lanes.find((l) => l.id === action.payload.laneId);
      const oldTimeSlot = state.timeSlots.find((t) => t.id === booking.timeSlotId);
      const newTimeSlot = state.timeSlots.find((t) => t.id === action.payload.timeSlotId);

      const updatedBookings = state.bookings.map((b) =>
        b.id === action.payload.id
          ? ({
              ...b,
              laneId: action.payload.laneId,
              timeSlotId: action.payload.timeSlotId,
              updatedAt: formatTime(new Date()),
            } as Booking)
          : b
      );
      const newConflicts = detectConflicts(updatedBookings, state.lanes, state.timeSlots);

      const historyItem = createHistoryRecord(
        'move',
        'booking',
        action.payload.id,
        `移动预约`,
        oldLane && oldTimeSlot
          ? `泳道${oldLane.number} (${oldTimeSlot.startTime}-${oldTimeSlot.endTime})`
          : undefined,
        newLane && newTimeSlot
          ? `泳道${newLane.number} (${newTimeSlot.startTime}-${newTimeSlot.endTime})`
          : undefined
      );

      return {
        ...state,
        bookings: updatedBookings,
        conflicts: newConflicts,
        history: [historyItem, ...state.history].slice(0, 50),
      };
    }

    case 'LOAD_SMOOTH_SAMPLE':
      return {
        ...state,
        bookings: sampleSmoothBookings,
        conflicts: [],
        history: [
          createHistoryRecord('create', 'booking', 'sample', '加载顺利样例数据'),
        ],
      };

    case 'LOAD_CONFLICT_SAMPLE':
      return {
        ...state,
        bookings: [...sampleSmoothBookings, ...sampleConflictBookings],
        conflicts: detectConflicts(
          [...sampleSmoothBookings, ...sampleConflictBookings],
          state.lanes,
          state.timeSlots
        ),
        history: [
          createHistoryRecord('create', 'booking', 'sample', '加载冲突样例数据'),
        ],
      };

    case 'CLEAR_ALL':
      return {
        ...state,
        bookings: [],
        conflicts: [],
        history: [createHistoryRecord('delete', 'booking', 'all', '清空所有预约')],
      };

    case 'CHECK_CONFLICTS':
      return {
        ...state,
        conflicts: detectConflicts(state.bookings, state.lanes, state.timeSlots),
      };

    case 'ADD_LANE': {
      const newLane: Lane = { ...action.payload, id: generateId() };
      return {
        ...state,
        lanes: [...state.lanes, newLane],
        history: [
          createHistoryRecord('create', 'lane', newLane.id, `添加泳道: ${newLane.name}`),
          ...state.history,
        ].slice(0, 50),
      };
    }

    case 'UPDATE_LANE': {
      const lane = state.lanes.find((l) => l.id === action.payload.id);
      if (!lane) return state;
      return {
        ...state,
        lanes: state.lanes.map((l) =>
          l.id === action.payload.id ? { ...l, ...action.payload.updates } : l
        ),
        history: [
          createHistoryRecord('update', 'lane', action.payload.id, `更新泳道信息`),
          ...state.history,
        ].slice(0, 50),
      };
    }

    case 'DELETE_LANE': {
      const lane = state.lanes.find((l) => l.id === action.payload);
      if (!lane) return state;
      return {
        ...state,
        lanes: state.lanes.filter((l) => l.id !== action.payload),
        bookings: state.bookings.filter((b) => b.laneId !== action.payload),
        history: [
          createHistoryRecord('delete', 'lane', action.payload, `删除泳道: ${lane.name}`),
          ...state.history,
        ].slice(0, 50),
      };
    }

    case 'ADD_TIMESLOT': {
      const newTimeSlot: TimeSlot = { ...action.payload, id: generateId() };
      return {
        ...state,
        timeSlots: [...state.timeSlots, newTimeSlot],
        history: [
          createHistoryRecord(
            'create',
            'timeslot',
            newTimeSlot.id,
            `添加时段: ${newTimeSlot.startTime}-${newTimeSlot.endTime}`
          ),
          ...state.history,
        ].slice(0, 50),
      };
    }

    case 'UPDATE_TIMESLOT': {
      const timeSlot = state.timeSlots.find((t) => t.id === action.payload.id);
      if (!timeSlot) return state;
      return {
        ...state,
        timeSlots: state.timeSlots.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
        ),
        history: [
          createHistoryRecord('update', 'timeslot', action.payload.id, `更新时段信息`),
          ...state.history,
        ].slice(0, 50),
      };
    }

    case 'DELETE_TIMESLOT': {
      const timeSlot = state.timeSlots.find((t) => t.id === action.payload);
      if (!timeSlot) return state;
      return {
        ...state,
        timeSlots: state.timeSlots.filter((t) => t.id !== action.payload),
        bookings: state.bookings.filter((b) => b.timeSlotId !== action.payload),
        history: [
          createHistoryRecord(
            'delete',
            'timeslot',
            action.payload,
            `删除时段: ${timeSlot.startTime}-${timeSlot.endTime}`
          ),
          ...state.history,
        ].slice(0, 50),
      };
    }

    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
