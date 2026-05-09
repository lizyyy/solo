import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum EventType {
  TICKET_CREATED = 'TicketCreated',
  TICKET_UPDATED = 'TicketUpdated',
  TICKET_STATUS_CHANGED = 'TicketStatusChanged',
  TICKET_ASSIGNED = 'TicketAssigned',
  FOLLOW_UP_ADDED = 'FollowUpAdded',
  FOLLOW_UP_UPDATED = 'FollowUpUpdated',
  FOLLOW_UP_COMPLETED = 'FollowUpCompleted',
  COMPENSATION_APPLIED = 'CompensationApplied',
  STATE_RESTORED = 'StateRestored',
  TICKET_DELETED = 'TicketDeleted',
  NOTE_ADDED = 'NoteAdded',
}

export enum AggregateType {
  TICKET = 'ticket',
  FOLLOW_UP = 'followup',
}

export enum OperatorType {
  USER = 'user',
  SYSTEM = 'system',
}

interface EventAttributes {
  id: string;
  aggregateId: string;
  aggregateType: AggregateType;
  eventType: EventType;
  eventData: Record<string, unknown>;
  version: number;
  requestId?: string;
  operatorId: string;
  operatorType: OperatorType;
  createdAt: Date;
}

interface EventCreationAttributes extends Optional<EventAttributes, 'id' | 'createdAt'> {}

export class Event extends Model<EventAttributes, EventCreationAttributes> {
  public id!: string;
  public aggregateId!: string;
  public aggregateType!: AggregateType;
  public eventType!: EventType;
  public eventData!: Record<string, unknown>;
  public version!: number;
  public requestId?: string;
  public operatorId!: string;
  public operatorType!: OperatorType;
  public readonly createdAt!: Date;
}

Event.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    aggregateId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'aggregate_id',
    },
    aggregateType: {
      type: DataTypes.ENUM(...Object.values(AggregateType)),
      allowNull: false,
      field: 'aggregate_type',
    },
    eventType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'event_type',
    },
    eventData: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'event_data',
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'request_id',
    },
    operatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'operator_id',
    },
    operatorType: {
      type: DataTypes.ENUM(...Object.values(OperatorType)),
      allowNull: false,
      field: 'operator_type',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'events',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['aggregate_id', 'version'], unique: true },
      { fields: ['aggregate_type'] },
      { fields: ['event_type', 'created_at'] },
      { fields: ['operator_id', 'created_at'] },
      { fields: ['request_id'] },
    ],
  }
);

export default Event;
