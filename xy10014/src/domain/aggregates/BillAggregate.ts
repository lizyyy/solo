import { v4 as uuidv4 } from 'uuid';
import {
  BillState,
  BillEvent,
  EventMetadata,
  CreateBillCommand,
  UpdateBillCommand,
  Participant,
} from '../types';
import {
  InvalidShareTotalError,
  InvalidPaidTotalError,
  BillAlreadyDeletedError,
  ConcurrencyConflictError,
  ConflictDetails,
  DiffEntry,
} from '../errors';

export class BillAggregate {
  private state: BillState;
  private uncommittedEvents: BillEvent[] = [];

  constructor() {
    this.state = {} as BillState;
  }

  static create(
    command: CreateBillCommand,
    metadata: EventMetadata
  ): BillAggregate {
    const aggregate = new BillAggregate();
    
    aggregate.validateParticipants(
      command.participants,
      command.totalAmount
    );

    aggregate.apply({
      type: 'BillCreated',
      payload: {
        id: command.id,
        groupId: command.groupId,
        title: command.title,
        description: command.description,
        totalAmount: command.totalAmount,
        currency: command.currency,
        date: command.date,
        category: command.category,
        participants: command.participants,
        createdBy: metadata.operatorId,
        createdAt: new Date().toISOString(),
      },
      metadata,
    });

    return aggregate;
  }

  update(
    command: UpdateBillCommand,
    metadata: EventMetadata
  ): void {
    this.validateNotDeleted();
    this.validateVersion(command.expectedVersion);
    this.validateParticipants(
      command.participants,
      command.totalAmount
    );

    this.apply({
      type: 'BillUpdated',
      payload: {
        id: this.state.id,
        title: command.title,
        description: command.description,
        totalAmount: command.totalAmount,
        currency: command.currency,
        date: command.date,
        category: command.category,
        participants: command.participants,
        updatedAt: new Date().toISOString(),
      },
      metadata,
    });
  }

  delete(metadata: EventMetadata, reason?: string): void {
    this.validateNotDeleted();

    this.apply({
      type: 'BillDeleted',
      payload: {
        id: this.state.id,
        deletedAt: new Date().toISOString(),
        reason,
      },
      metadata: {
        ...metadata,
        reason,
      },
    });
  }

  addParticipant(
    participant: Participant,
    newTotalAmount: number,
    expectedVersion: number,
    metadata: EventMetadata
  ): void {
    this.validateNotDeleted();
    this.validateVersion(expectedVersion);

    const participants = [...this.state.participants, participant];
    this.validateParticipants(participants, newTotalAmount);

    this.apply({
      type: 'ParticipantAdded',
      payload: {
        id: this.state.id,
        participant,
        totalAmount: newTotalAmount,
        updatedAt: new Date().toISOString(),
      },
      metadata,
    });
  }

  removeParticipant(
    userId: string,
    newTotalAmount: number,
    expectedVersion: number,
    metadata: EventMetadata
  ): void {
    this.validateNotDeleted();
    this.validateVersion(expectedVersion);

    const participants = this.state.participants.filter(
      p => p.userId !== userId
    );
    this.validateParticipants(participants, newTotalAmount);

    this.apply({
      type: 'ParticipantRemoved',
      payload: {
        id: this.state.id,
        removedUserId: userId,
        totalAmount: newTotalAmount,
        updatedAt: new Date().toISOString(),
      },
      metadata,
    });
  }

  private apply(event: BillEvent): void {
    if (!event.id) {
      event.id = uuidv4();
    }
    this.mutate(event);
    this.uncommittedEvents.push(event);
  }

  private mutate(event: BillEvent): void {
    switch (event.type) {
      case 'BillCreated':
        this.state = {
          ...event.payload,
          version: 1,
          isDeleted: false,
        };
        break;

      case 'BillUpdated':
        this.state = {
          ...this.state,
          ...event.payload,
          version: (this.state.version || 0) + 1,
        };
        break;

      case 'BillDeleted':
        this.state = {
          ...this.state,
          isDeleted: true,
          version: (this.state.version || 0) + 1,
        };
        break;

      case 'ParticipantAdded':
        this.state = {
          ...this.state,
          participants: [...this.state.participants, event.payload.participant],
          totalAmount: event.payload.totalAmount,
          updatedAt: event.payload.updatedAt,
          version: (this.state.version || 0) + 1,
        };
        break;

      case 'ParticipantRemoved':
        this.state = {
          ...this.state,
          participants: this.state.participants.filter(
            p => p.userId !== event.payload.removedUserId
          ),
          totalAmount: event.payload.totalAmount,
          updatedAt: event.payload.updatedAt,
          version: (this.state.version || 0) + 1,
        };
        break;
    }
  }

  private validateNotDeleted(): void {
    if (this.state.isDeleted) {
      throw new BillAlreadyDeletedError(this.state.id);
    }
  }

  private validateVersion(expectedVersion: number): void {
    if (this.state.version !== expectedVersion) {
      throw new ConcurrencyConflictError({
        aggregateId: this.state.id,
        expectedVersion,
        actualVersion: this.state.version,
      });
    }
  }

  private validateParticipants(
    participants: Participant[],
    totalAmount: number
  ): void {
    const shareTotal = participants.reduce(
      (sum, p) => sum + p.shareAmount,
      0
    );
    const paidTotal = participants.reduce(
      (sum, p) => sum + p.paidAmount,
      0
    );

    if (Math.abs(shareTotal - totalAmount) > 0.0001) {
      throw new InvalidShareTotalError();
    }

    if (Math.abs(paidTotal - totalAmount) > 0.0001) {
      throw new InvalidPaidTotalError();
    }
  }

  getConflictDetails(
    expectedVersion: number
  ): ConflictDetails {
    return {
      currentState: {
        title: this.state.title,
        totalAmount: this.state.totalAmount,
        participants: this.state.participants,
      },
      changes: [],
    };
  }

  computeDiff(
    from: Partial<BillState>,
    to: Partial<BillState>
  ): DiffEntry[] {
    const diff: DiffEntry[] = [];
    const allKeys = new Set([
      ...Object.keys(from || {}),
      ...Object.keys(to || {}),
    ]);

    for (const key of allKeys) {
      const fromValue = JSON.stringify(from?.[key as keyof BillState]);
      const toValue = JSON.stringify(to?.[key as keyof BillState]);

      if (fromValue !== toValue) {
        diff.push({
          field: key,
          from: from?.[key as keyof BillState],
          to: to?.[key as keyof BillState],
          type: from?.[key as keyof BillState] === undefined
            ? 'ADD'
            : to?.[key as keyof BillState] === undefined
              ? 'REMOVE'
              : 'CHANGE',
        });
      }
    }

    return diff;
  }

  static fromHistory(events: BillEvent[]): BillAggregate {
    const aggregate = new BillAggregate();
    
    for (const event of events) {
      aggregate.mutate(event);
    }

    return aggregate;
  }

  getState(): BillState {
    return { ...this.state };
  }

  getUncommittedEvents(): BillEvent[] {
    return [...this.uncommittedEvents];
  }

  clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }

  getVersion(): number {
    return this.state.version || 0;
  }

  getId(): string {
    return this.state.id;
  }

  isDeleted(): boolean {
    return this.state.isDeleted;
  }
}
