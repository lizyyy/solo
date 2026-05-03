import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export interface Project {
  id: string;
  name: string;
  description: string;
  machine?: StateMachine;
  eventSequence?: EventItem[];
  executionHistory?: ExecutionHistory;
  checkResults?: CheckResults;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface StateMachine {
  name: string;
  description: string;
  initialState: string;
  states: Record<string, State>;
  events: Record<string, Event>;
  metadata?: Record<string, unknown>;
}

export interface State {
  id: string;
  name: string;
  description: string;
  type: 'initial' | 'final' | 'normal';
  on: Record<string, Transition[]>;
  actions: {
    entry: string[];
    exit: string[];
    do: string[];
  };
  metadata?: Record<string, unknown>;
}

export interface Transition {
  target: string;
  guard?: Guard | null;
  actions: string[];
  description: string;
  source: string;
}

export interface Guard {
  condition: string;
  description: string;
  params: Record<string, unknown>;
}

export interface Event {
  name: string;
  description: string;
  triggeredBy: string[];
}

export interface EventItem {
  name: string;
  data?: Record<string, unknown>;
}

export interface ExecutionHistory {
  eventSequence: EventItem[];
  context: Record<string, unknown>;
  timeline: TimelineEntry[];
  finalState: string;
  success: boolean;
  firstFailureIndex: number;
  executedAt: string;
}

export interface TimelineEntry {
  type: 'initial' | 'transition' | 'invalid_event' | 'guard_failed' | 'error';
  step: number;
  timestamp: number;
  state?: string;
  stateInfo?: State;
  event?: string;
  eventData?: Record<string, unknown>;
  fromState?: string;
  fromStateInfo?: State;
  toState?: string;
  toStateInfo?: State;
  transition?: {
    guard: Guard | null;
    guardResult: GuardResult;
    actions: string[];
    description: string;
  };
  availableEvents?: string[];
  transitions?: Transition[];
  message: string;
  isFinal?: boolean;
  contextSnapshot: Record<string, unknown>;
}

export interface GuardResult {
  passed: boolean;
  condition?: string;
  description?: string;
  reason: string;
}

export interface CheckResults {
  machine: {
    name: string;
    stateCount: number;
    eventCount: number;
  };
  checks: CheckItem[];
  summary: {
    totalChecks: number;
    totalIssues: number;
    hasErrors: boolean;
    hasWarnings: boolean;
    overall: 'pass' | 'warning' | 'fail';
  };
}

export interface CheckItem {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning';
  passed: boolean;
  count: number;
  issues: IssueItem[];
}

export interface IssueItem {
  type: string;
  state?: string;
  stateInfo?: State;
  event?: string;
  transitions?: Transition[];
  message: string;
  detail?: string;
  location: {
    state?: string;
    event?: string;
    target?: string;
    guard?: string;
  };
}

export const projectApi = {
  list: (): Promise<AxiosResponse<{ success: boolean; projects: Project[] }>> =>
    api.get('/projects'),
  
  get: (id: string): Promise<AxiosResponse<{ success: boolean; project: Project }>> =>
    api.get(`/projects/${id}`),
  
  create: (data: Partial<Project>): Promise<AxiosResponse<{ success: boolean; projectId: string; project: Project }>> =>
    api.post('/projects', data),
  
  update: (id: string, data: Partial<Project>): Promise<AxiosResponse<{ success: boolean; projectId: string; project: Project }>> =>
    api.put(`/projects/${id}`, { ...data, id }),
  
  delete: (id: string): Promise<AxiosResponse<{ success: boolean }>> =>
    api.delete(`/projects/${id}`),
  
  import: (content: string, name?: string): Promise<AxiosResponse<{ success: boolean; projectId: string; project: Project; machine: StateMachine }>> =>
    api.post('/projects/import', { content, name }),
  
  parse: (content: string): Promise<AxiosResponse<{ success: boolean; machine: StateMachine; validation: { valid: boolean; errors: string[] } }>> =>
    api.post('/projects/parse', { content }),
  
  check: (id: string): Promise<AxiosResponse<{ success: boolean; checkResults: CheckResults }>> =>
    api.post(`/projects/${id}/check`),
  
  execute: (id: string, params: { eventSequence: EventItem[]; context?: Record<string, unknown>; stopOnError?: boolean }): Promise<AxiosResponse<{ success: boolean; executionResult: { success: boolean; timeline: TimelineEntry[]; finalState: string } }>> =>
    api.post(`/projects/${id}/execute`, params)
};

export const examplesApi = {
  list: (): Promise<AxiosResponse<{ success: boolean; examples: { filename: string; name: string; description: string; stateCount: number; eventCount: number }[] }>> =>
    api.get('/examples'),
  
  get: (filename: string): Promise<AxiosResponse<{ success: boolean; filename: string; content: string; machine: StateMachine }>> =>
    api.get(`/examples/${filename}`)
};

export const reportApi = {
  get: (projectId: string, format: 'html' | 'markdown' = 'html', download = false): Promise<string> =>
    api.get(`/reports/${projectId}`, {
      params: { format, download },
      responseType: 'text'
    })
};

export default api;
