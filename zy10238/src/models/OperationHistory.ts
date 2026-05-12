import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum OperationType {
  FAULT_REPORTED = 'fault_reported',
  REMOTE_RESTART_TRIGGERED = 'remote_restart_triggered',
  REMOTE_RESTART_SUCCESS = 'remote_restart_success',
  REMOTE_RESTART_FAILED = 'remote_restart_failed',
  DISPATCH_CREATED = 'dispatch_created',
  MAINTENANCE_STARTED = 'maintenance_started',
  MAINTENANCE_COMPLETED = 'maintenance_completed',
  REFUND_REQUESTED = 'refund_requested',
  REFUND_APPROVED = 'refund_approved',
  REFUND_REJECTED = 'refund_rejected',
  TICKET_CLOSED = 'ticket_closed',
  TICKET_REOPENED = 'ticket_reopened',
  STATUS_CHANGED = 'status_changed',
  DUPLICATE_DETECTED = 'duplicate_detected',
}

interface OperationHistoryAttributes {
  id: string;
  ticketId: string;
  operationType: OperationType;
  operatorId?: string;
  operatorName?: string;
  description: string;
  details?: Record<string, any>;
  oldStatus?: string;
  newStatus?: string;
  operatedAt: Date;
}

class OperationHistory extends Model<OperationHistoryAttributes> implements OperationHistoryAttributes {
  public id!: string;
  public ticketId!: string;
  public operationType!: OperationType;
  public operatorId?: string;
  public operatorName?: string;
  public description!: string;
  public details?: Record<string, any>;
  public oldStatus?: string;
  public newStatus?: string;
  public operatedAt!: Date;
}

OperationHistory.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'fault_tickets',
        key: 'id',
      },
    },
    operationType: {
      type: DataTypes.ENUM(...Object.values(OperationType)),
      allowNull: false,
    },
    operatorId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    operatorName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    oldStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    newStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    operatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'operation_histories',
    indexes: [
      { fields: ['ticketId'] },
      { fields: ['operationType'] },
      { fields: ['operatedAt'] },
    ],
  }
);

export default OperationHistory;
