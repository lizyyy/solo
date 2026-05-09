export interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  currentParticipants: number;
  status: 'draft' | 'active' | 'cancelled' | 'completed';
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Registration {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted';
  notes?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export enum EventType {
  EVENT_CREATED = 'EVENT_CREATED',
  EVENT_UPDATED = 'EVENT_UPDATED',
  EVENT_CANCELLED = 'EVENT_CANCELLED',
  EVENT_TIME_CHANGED = 'EVENT_TIME_CHANGED',
  REGISTRATION_CREATED = 'REGISTRATION_CREATED',
  REGISTRATION_UPDATED = 'REGISTRATION_UPDATED',
  REGISTRATION_CANCELLED = 'REGISTRATION_CANCELLED',
  REGISTRATION_CONFIRMED = 'REGISTRATION_CONFIRMED',
}

export interface EventLogEntry {
  id: string;
  aggregateType: 'event' | 'registration';
  aggregateId: string;
  eventType: EventType;
  eventVersion: number;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  requestId?: string;
  ipAddress?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateEventDto {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
}

export interface UpdateEventDto {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  maxParticipants?: number;
  status?: 'draft' | 'active' | 'cancelled';
}

export interface CreateRegistrationDto {
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  notes?: string;
}

export interface UpdateRegistrationDto {
  status?: 'confirmed' | 'cancelled';
  notes?: string;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export type ExportFormat = 'excel' | 'markdown' | 'pdf';
