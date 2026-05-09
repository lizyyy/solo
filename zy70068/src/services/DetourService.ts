import { DetourEvent, DetourStatus, DetourReason } from '../models/types';
import { repository } from '../repositories/MemoryRepository';
import { lineService } from './LineService';
import {
  DetourConflictError,
  DetourAlreadyActiveError,
  DetourCancelledError,
} from '../models/errors';

export interface CreateDetourRequest {
  lineId: string;
  reason: DetourReason;
  description: string;
  affectedStopIds: string[];
  alternativeStopIds: string[];
  reportedBy: string;
  priority?: number;
}

export class DetourService {
  private readonly CONFLICT_OVERLAP_THRESHOLD = 0.3;

  createDetour(request: CreateDetourRequest): DetourEvent {
    const lineVersion = lineService.getActiveLineVersion(request.lineId);
    
    const now = new Date();
    const event: DetourEvent = {
      id: repository.generateId(),
      lineId: request.lineId,
      lineVersionId: lineVersion.id,
      reason: request.reason,
      description: request.description,
      affectedStopIds: [...request.affectedStopIds],
      alternativeStopIds: [...request.alternativeStopIds],
      status: 'PENDING',
      reportedBy: request.reportedBy,
      reportedAt: now,
      startTime: now,
      priority: request.priority ?? 1,
    };

    const conflicts = this.detectConflicts(event);
    if (conflicts.length > 0) {
      event.status = 'CONFLICT';
      event.conflictWith = conflicts.map((c) => c.id);
      repository.saveDetourEvent(event);
      throw new DetourConflictError(conflicts[0].id);
    }

    return repository.saveDetourEvent(event);
  }

  activateDetour(eventId: string): DetourEvent {
    const event = repository.findDetourEventById(eventId);
    if (!event) {
      throw new Error(`绕行事件 ${eventId} 不存在`);
    }

    if (event.status === 'ACTIVE') {
      throw new DetourAlreadyActiveError(eventId);
    }

    if (event.status === 'CANCELLED') {
      throw new DetourCancelledError(eventId);
    }

    const conflicts = this.detectConflicts(event);
    if (conflicts.length > 0) {
      const higherPriorityConflicts = conflicts.filter((c) => c.priority >= event.priority);
      if (higherPriorityConflicts.length > 0) {
        throw new DetourConflictError(higherPriorityConflicts[0].id);
      }
    }

    event.status = 'ACTIVE';
    event.startTime = new Date();
    return repository.saveDetourEvent(event);
  }

  resolveDetour(eventId: string): DetourEvent {
    const event = repository.findDetourEventById(eventId);
    if (!event) {
      throw new Error(`绕行事件 ${eventId} 不存在`);
    }

    if (event.status !== 'ACTIVE') {
      throw new Error(`绕行事件 ${eventId} 未处于激活状态`);
    }

    event.status = 'RESOLVED';
    event.endTime = new Date();
    return repository.saveDetourEvent(event);
  }

  cancelDetour(eventId: string, reason?: string): DetourEvent {
    const event = repository.findDetourEventById(eventId);
    if (!event) {
      throw new Error(`绕行事件 ${eventId} 不存在`);
    }

    if (event.status === 'CANCELLED' || event.status === 'RESOLVED') {
      return event;
    }

    event.status = 'CANCELLED';
    event.endTime = new Date();
    event.description = reason 
      ? `${event.description} [撤销原因: ${reason}]`
      : event.description;
    return repository.saveDetourEvent(event);
  }

  detectConflicts(newEvent: DetourEvent): DetourEvent[] {
    const activeEvents = repository.findActiveDetours(newEvent.lineId);
    const conflicts: DetourEvent[] = [];

    for (const existing of activeEvents) {
      if (existing.id === newEvent.id) continue;
      
      const affectedOverlap = this.calculateOverlap(
        newEvent.affectedStopIds,
        existing.affectedStopIds
      );

      const alternativeOverlap = this.calculateOverlap(
        newEvent.alternativeStopIds,
        existing.alternativeStopIds
      );

      if (affectedOverlap > this.CONFLICT_OVERLAP_THRESHOLD || alternativeOverlap > this.CONFLICT_OVERLAP_THRESHOLD) {
        conflicts.push(existing);
      }
    }

    return conflicts;
  }

  private calculateOverlap(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 || arr2.length === 0) return 0;
    const set1 = new Set(arr1);
    const intersection = arr2.filter((x) => set1.has(x));
    return intersection.length / Math.min(arr1.length, arr2.length);
  }

  getDetour(eventId: string): DetourEvent | undefined {
    return repository.findDetourEventById(eventId);
  }

  getActiveDetours(lineId: string): DetourEvent[] {
    return repository.findActiveDetours(lineId);
  }

  getDetoursByStatus(statuses: DetourStatus[]): DetourEvent[] {
    return repository.findDetoursByStatus(statuses);
  }

  isStopAffected(lineId: string, stopId: string): boolean {
    const activeDetours = repository.findActiveDetours(lineId);
    return activeDetours.some((d) => d.affectedStopIds.includes(stopId));
  }

  getAlternativeStops(lineId: string, stopId: string): string[] {
    const activeDetours = repository.findActiveDetours(lineId);
    const relevantDetour = activeDetours.find((d) => d.affectedStopIds.includes(stopId));
    return relevantDetour?.alternativeStopIds ?? [];
  }
}

export const detourService = new DetourService();
