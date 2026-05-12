import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  Event,
  Registration,
  EventLogEntry,
  CreateEventDto,
  UpdateEventDto,
  CreateRegistrationDto,
  UpdateRegistrationDto,
  PaginatedResult,
  ExportFormat,
} from '@/types';

const API_BASE_URL = '/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      if (!config.headers['X-Request-Id']) {
        config.headers['X-Request-Id'] = uuidv4();
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const message = error.response?.data?.error?.message || error.message;
        const apiError = new Error(message);
        (apiError as unknown as { code: string; details: unknown }).code =
          error.response?.data?.error?.code || 'UNKNOWN_ERROR';
        (apiError as unknown as { code: string; details: unknown }).details =
          error.response?.data?.error?.details;
        throw apiError;
      }
    );
  }

  generateIdempotencyToken(): string {
    return uuidv4();
  }

  async getEvents(
    params: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
    } = {}
  ): Promise<PaginatedResult<Event>> {
    const response = await this.client.get('/events', { params });
    return response.data;
  }

  async getEvent(id: string): Promise<Event> {
    const response = await this.client.get(`/events/${id}`);
    return response.data;
  }

  async createEvent(
    dto: CreateEventDto,
    idempotencyToken?: string
  ): Promise<Event> {
    const headers: Record<string, string> = {};
    if (idempotencyToken) {
      headers['X-Idempotency-Token'] = idempotencyToken;
    }
    const response = await this.client.post('/events', dto, { headers });
    return response.data;
  }

  async updateEvent(
    id: string,
    dto: UpdateEventDto,
    expectedVersion: number
  ): Promise<Event> {
    const response = await this.client.put(`/events/${id}`, dto, {
      headers: {
        'If-Match': expectedVersion.toString(),
      },
    });
    return response.data;
  }

  async cancelEvent(id: string, expectedVersion: number): Promise<Event> {
    const response = await this.client.delete(`/events/${id}`, {
      headers: {
        'If-Match': expectedVersion.toString(),
      },
    });
    return response.data;
  }

  async getEventRegistrations(
    eventId: string,
    params: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
    } = {}
  ): Promise<PaginatedResult<Registration>> {
    const response = await this.client.get(`/registrations/event/${eventId}`, {
      params,
    });
    return response.data;
  }

  async checkRegistration(
    eventId: string,
    userId: string
  ): Promise<{ registered: boolean; status?: string; version?: number }> {
    const response = await this.client.get(
      `/registrations/check/${eventId}/${userId}`
    );
    return response.data;
  }

  async createRegistration(
    dto: CreateRegistrationDto,
    idempotencyToken?: string
  ): Promise<Registration> {
    const headers: Record<string, string> = {};
    if (idempotencyToken) {
      headers['X-Idempotency-Token'] = idempotencyToken;
    }
    const response = await this.client.post('/registrations', dto, { headers });
    return response.data;
  }

  async updateRegistration(
    id: string,
    dto: UpdateRegistrationDto,
    expectedVersion: number
  ): Promise<Registration> {
    const response = await this.client.put(`/registrations/${id}`, dto, {
      headers: {
        'If-Match': expectedVersion.toString(),
      },
    });
    return response.data;
  }

  async cancelRegistration(
    id: string,
    expectedVersion: number
  ): Promise<Registration> {
    const response = await this.client.delete(`/registrations/${id}`, {
      headers: {
        'If-Match': expectedVersion.toString(),
      },
    });
    return response.data;
  }

  async getEventLog(
    params: {
      page?: number;
      pageSize?: number;
      aggregateType?: 'event' | 'registration';
      eventType?: string;
      fromTime?: string;
      toTime?: string;
    } = {}
  ): Promise<{ entries: EventLogEntry[]; total: number; hasMore: boolean }> {
    const response = await this.client.get('/event-log', { params });
    return response.data;
  }

  async getEventLogByAggregate(
    aggregateType: 'event' | 'registration',
    aggregateId: string
  ): Promise<{ entries: EventLogEntry[] }> {
    const response = await this.client.get(
      `/event-log/aggregate/${aggregateType}/${aggregateId}`
    );
    return response.data;
  }

  async getEventLogByEvent(eventId: string): Promise<{ entries: EventLogEntry[] }> {
    const response = await this.client.get(`/event-log/event/${eventId}`);
    return response.data;
  }

  async replayEvents(
    aggregateType: 'event' | 'registration',
    aggregateId: string,
    toTime?: string
  ): Promise<{ events: EventLogEntry[]; eventCount: number }> {
    const response = await this.client.get(
      `/event-log/replay/${aggregateType}/${aggregateId}`,
      {
        params: toTime ? { toTime } : {},
      }
    );
    return response.data;
  }

  async exportEvent(
    eventId: string,
    format: ExportFormat,
    includeCancelled: boolean = false
  ): Promise<AxiosResponse<Blob>> {
    return this.client.get(`/exports/event/${eventId}`, {
      params: {
        format,
        includeCancelled,
      },
      responseType: 'blob',
    });
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const api = new ApiClient();
export default api;
