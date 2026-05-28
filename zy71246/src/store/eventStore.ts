import { create } from 'zustand';
import type { EventLog, ErrorDetail } from '../types/mission';
import { handleError } from '../engine/errorHandler';
import { generateId } from '../utils/time';

interface EventStore {
  events: EventLog[];
  addEvent: (event: Omit<EventLog, 'id'>) => EventLog;
  addError: (errorDetail: ErrorDetail, timestamp: number, currentScore: number) => { 
    event: EventLog; 
    scoreDeduction: number; 
    impact: string 
  };
  clearEvents: () => void;
  getErrorsByType: (type?: string) => EventLog[] | Record<string, EventLog[]>;
  getCriticalErrors: () => EventLog[];
  getEventsInRange: (startTime: number, endTime: number) => EventLog[];
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],

  addEvent: (event) => {
    const newEvent: EventLog = {
      ...event,
      id: generateId(),
    };
    set(state => ({ events: [...state.events, newEvent] }));
    return newEvent;
  },

  addError: (errorDetail, timestamp, currentScore) => {
    const result = handleError(errorDetail, currentScore, timestamp);
    set(state => ({ events: [...state.events, result.event] }));
    return result;
  },

  clearEvents: () => set({ events: [] }),

  getErrorsByType: (type?: string) => {
    const { events } = get();
    const groups: Record<string, EventLog[]> = {
      window_missed: [],
      command_timeout: [],
      data_packet_lost: [],
    };

    events.forEach(event => {
      if (event.errorDetail) {
        groups[event.errorDetail.errorType].push(event);
      }
    });

    if (type) {
      return groups[type] || [];
    }
    return groups;
  },

  getCriticalErrors: () => {
    const { events } = get();
    return events.filter(e => e.severity === 'critical');
  },

  getEventsInRange: (startTime, endTime) => {
    const { events } = get();
    return events.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  },
}));
