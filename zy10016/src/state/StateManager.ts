import { v4 as uuidv4 } from 'uuid';
import {
  TransactionState,
  OperationType,
  LogEntry,
} from '../types';

export type ResourceStatus = 'IDLE' | 'WAITING' | 'LOCKED' | 'CONFLICT';

export interface ResourceState {
  id: string;
  type: 'CONNECTION' | 'TRANSACTION' | 'OPERATION';
  status: ResourceStatus;
  lockType: 'NONE' | 'SHARED' | 'EXCLUSIVE';
  holdingConnections: string[];
  waitingConnections: string[];
  lastActivity: number;
  metadata?: Record<string, unknown>;
}

export interface StateTransition {
  from: ResourceStatus;
  to: ResourceStatus;
  operation: OperationType;
  condition?: () => boolean;
  action?: () => void;
}

export class StateManager {
  private readonly resources = new Map<string, ResourceState>();
  private readonly transitions = new Map<string, StateTransition[]>();
  private readonly stateHistory: Array<{
    timestamp: number;
    resourceId: string;
    from: ResourceStatus;
    to: ResourceStatus;
    metadata?: Record<string, unknown>;
  }> = [];

  private readonly maxHistorySize = 10000;

  constructor() {
    this.initializeDefaultTransitions();
  }

  private initializeDefaultTransitions(): void {
    const connectionTransitions: StateTransition[] = [
      {
        from: 'IDLE',
        to: 'WAITING',
        operation: 'READ',
      },
      {
        from: 'IDLE',
        to: 'LOCKED',
        operation: 'WRITE',
      },
      {
        from: 'IDLE',
        to: 'LOCKED',
        operation: 'BEGIN_TRANSACTION',
      },
      {
        from: 'WAITING',
        to: 'LOCKED',
        operation: 'READ',
      },
      {
        from: 'WAITING',
        to: 'CONFLICT',
        operation: 'WRITE',
      },
      {
        from: 'LOCKED',
        to: 'IDLE',
        operation: 'COMMIT',
      },
      {
        from: 'LOCKED',
        to: 'IDLE',
        operation: 'ROLLBACK',
      },
      {
        from: 'LOCKED',
        to: 'CONFLICT',
        operation: 'WRITE',
      },
      {
        from: 'CONFLICT',
        to: 'WAITING',
        operation: 'READ',
      },
      {
        from: 'CONFLICT',
        to: 'IDLE',
        operation: 'COMMIT',
      },
      {
        from: 'CONFLICT',
        to: 'IDLE',
        operation: 'ROLLBACK',
      },
    ];

    this.transitions.set('CONNECTION', connectionTransitions);
  }

  registerResource(resource: Omit<ResourceState, 'lastActivity'>): ResourceState {
    const state: ResourceState = {
      ...resource,
      lastActivity: Date.now(),
    };
    this.resources.set(resource.id, state);
    return state;
  }

  unregisterResource(resourceId: string): boolean {
    return this.resources.delete(resourceId);
  }

  getResource(resourceId: string): ResourceState | undefined {
    return this.resources.get(resourceId);
  }

  getAllResources(): ResourceState[] {
    return Array.from(this.resources.values());
  }

  canTransition(
    resourceId: string,
    operation: OperationType,
    resourceType?: 'CONNECTION' | 'TRANSACTION' | 'OPERATION'
  ): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource) return false;

    const type = resourceType || resource.type;
    const transitions = this.transitions.get(type);
    if (!transitions) return false;

    const validTransition = transitions.find(
      (t) => t.from === resource.status && t.operation === operation
    );

    if (!validTransition) return false;

    if (validTransition.condition) {
      return validTransition.condition();
    }

    return true;
  }

  transition(
    resourceId: string,
    operation: OperationType,
    metadata?: Record<string, unknown>
  ): ResourceState {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceId}`);
    }

    const transitions = this.transitions.get(resource.type);
    if (!transitions) {
      throw new Error(`No transitions defined for type: ${resource.type}`);
    }

    const validTransition = transitions.find(
      (t) => t.from === resource.status && t.operation === operation
    );

    if (!validTransition) {
      throw new Error(
        `Invalid state transition: ${resource.status} -> ??? with operation ${operation}`
      );
    }

    if (validTransition.condition && !validTransition.condition()) {
      throw new Error('Transition condition not met');
    }

    const oldStatus = resource.status;
    const newStatus = validTransition.to;

    this.stateHistory.push({
      timestamp: Date.now(),
      resourceId,
      from: oldStatus,
      to: newStatus,
      metadata,
    });

    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    if (validTransition.action) {
      validTransition.action();
    }

    resource.status = newStatus;
    resource.lastActivity = Date.now();

    return resource;
  }

  updateResourceLock(
    resourceId: string,
    lockType: 'NONE' | 'SHARED' | 'EXCLUSIVE'
  ): ResourceState {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceId}`);
    }

    resource.lockType = lockType;
    resource.lastActivity = Date.now();

    return resource;
  }

  addHoldingConnection(resourceId: string, connectionId: string): void {
    const resource = this.resources.get(resourceId);
    if (resource && !resource.holdingConnections.includes(connectionId)) {
      resource.holdingConnections.push(connectionId);
    }
  }

  removeHoldingConnection(resourceId: string, connectionId: string): void {
    const resource = this.resources.get(resourceId);
    if (resource) {
      const index = resource.holdingConnections.indexOf(connectionId);
      if (index !== -1) {
        resource.holdingConnections.splice(index, 1);
      }
    }
  }

  addWaitingConnection(resourceId: string, connectionId: string): void {
    const resource = this.resources.get(resourceId);
    if (resource && !resource.waitingConnections.includes(connectionId)) {
      resource.waitingConnections.push(connectionId);
    }
  }

  removeWaitingConnection(resourceId: string, connectionId: string): void {
    const resource = this.resources.get(resourceId);
    if (resource) {
      const index = resource.waitingConnections.indexOf(connectionId);
      if (index !== -1) {
        resource.waitingConnections.splice(index, 1);
      }
    }
  }

  getResourcesInConflict(): ResourceState[] {
    return this.getAllResources().filter((r) => r.status === 'CONFLICT');
  }

  getResourcesByStatus(status: ResourceStatus): ResourceState[] {
    return this.getAllResources().filter((r) => r.status === status);
  }

  getStateHistory(
    resourceId?: string,
    limit?: number
  ): typeof this.stateHistory {
    let history = this.stateHistory;

    if (resourceId) {
      history = history.filter((h) => h.resourceId === resourceId);
    }

    if (limit) {
      history = history.slice(-limit);
    }

    return [...history];
  }

  getConflictsReport(): {
    totalConflicts: number;
    activeConflicts: number;
    conflictDetails: Array<{
      resourceId: string;
      lockType: string;
      holding: string[];
      waiting: string[];
      lastActivity: number;
    }>;
  } {
    const activeConflicts = this.getResourcesInConflict();
    const conflictHistory = this.stateHistory.filter((h) => h.to === 'CONFLICT');

    return {
      totalConflicts: conflictHistory.length,
      activeConflicts: activeConflicts.length,
      conflictDetails: activeConflicts.map((r) => ({
        resourceId: r.id,
        lockType: r.lockType,
        holding: [...r.holdingConnections],
        waiting: [...r.waitingConnections],
        lastActivity: r.lastActivity,
      })),
    };
  }

  clear(): void {
    this.resources.clear();
    this.stateHistory.length = 0;
  }
}
