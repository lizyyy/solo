import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum FollowUpType {
  CALL = 'call',
  MESSAGE = 'message',
  EMAIL = 'email',
  COMPENSATION = 'compensation',
  VISIT = 'visit',
  OTHER = 'other',
}

export enum FollowUpStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

interface FollowUpAttributes {
  id: string;
  ticketId: string;
  content: string;
  followUpType: FollowUpType;
  promisedAction?: string;
  promisedDeadline?: Date;
  status: FollowUpStatus;
  assigneeId?: string;
  createdBy: string;
  completedAt?: Date;
  completionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FollowUpCreationAttributes extends Optional<FollowUpAttributes, 'id' | 'createdAt' | 'updatedAt' | 'status'> {}

export class FollowUp extends Model<FollowUpAttributes, FollowUpCreationAttributes> {
  public id!: string;
  public ticketId!: string;
  public content!: string;
  public followUpType!: FollowUpType;
  public promisedAction?: string;
  public promisedDeadline?: Date;
  public status!: FollowUpStatus;
  public assigneeId?: string;
  public createdBy!: string;
  public completedAt?: Date;
  public completionNote?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FollowUp.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'ticket_id',
      references: {
        model: 'tickets',
        key: 'id',
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    followUpType: {
      type: DataTypes.ENUM(...Object.values(FollowUpType)),
      allowNull: false,
      field: 'follow_up_type',
    },
    promisedAction: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'promised_action',
    },
    promisedDeadline: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'promised_deadline',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(FollowUpStatus)),
      allowNull: false,
      defaultValue: FollowUpStatus.PENDING,
    },
    assigneeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'assignee_id',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
    completionNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'completion_note',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'follow_ups',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['ticket_id'] },
      { fields: ['assignee_id'] },
      { fields: ['status'] },
      { fields: ['created_by'] },
      { 
        fields: ['promised_deadline'], 
        where: { status: 'pending' },
        name: 'idx_followups_deadline_pending'
      },
      { fields: ['created_at'] },
    ],
  }
);

export default FollowUp;
