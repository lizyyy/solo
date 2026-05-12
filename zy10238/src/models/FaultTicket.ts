import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum TicketStatus {
  NEW = 'new',
  REMOTE_RESTART_PENDING = 'remote_restart_pending',
  REMOTE_RESTART_SUCCESS = 'remote_restart_success',
  REMOTE_RESTART_FAILED = 'remote_restart_failed',
  DISPATCH_PENDING = 'dispatch_pending',
  MAINTENANCE_IN_PROGRESS = 'maintenance_in_progress',
  MAINTENANCE_COMPLETED = 'maintenance_completed',
  REFUNDED = 'refunded',
  CLOSED = 'closed',
  REOPENED = 'reopened',
}

export enum FailureReason {
  UNKNOWN = 'unknown',
  COMMUNICATION_ERROR = 'communication_error',
  POWER_SUPPLY_ISSUE = 'power_supply_issue',
  HARDWARE_FAILURE = 'hardware_failure',
  SOFTWARE_BUG = 'software_bug',
  OVERHEAT = 'overheat',
  GUN_LOCK_FAILURE = 'gun_lock_failure',
  PAYMENT_FAILURE = 'payment_failure',
}

interface FaultTicketAttributes {
  id: string;
  ticketCode: string;
  stationId: string;
  pileId: string;
  faultCode: string;
  faultMessage: string;
  faultLevel: string;
  failureReason: FailureReason;
  status: TicketStatus;
  orderId?: string;
  userId?: string;
  remoteRestartAttempts: number;
  maxRemoteRestarts: number;
  isDuplicate: boolean;
  originalTicketId?: string;
  reportedAt: Date;
  lastStatusChangeAt: Date;
  closedAt?: Date;
}

class FaultTicket extends Model<FaultTicketAttributes> implements FaultTicketAttributes {
  public id!: string;
  public ticketCode!: string;
  public stationId!: string;
  public pileId!: string;
  public faultCode!: string;
  public faultMessage!: string;
  public faultLevel!: string;
  public failureReason!: FailureReason;
  public status!: TicketStatus;
  public orderId?: string;
  public userId?: string;
  public remoteRestartAttempts!: number;
  public maxRemoteRestarts!: number;
  public isDuplicate!: boolean;
  public originalTicketId?: string;
  public reportedAt!: Date;
  public lastStatusChangeAt!: Date;
  public closedAt?: Date;
}

FaultTicket.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    ticketCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    stationId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pileId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    faultCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    faultMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    faultLevel: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    failureReason: {
      type: DataTypes.ENUM(...Object.values(FailureReason)),
      allowNull: false,
      defaultValue: FailureReason.UNKNOWN,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TicketStatus)),
      allowNull: false,
      defaultValue: TicketStatus.NEW,
    },
    orderId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    remoteRestartAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    maxRemoteRestarts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
    },
    isDuplicate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    originalTicketId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'fault_tickets',
        key: 'id',
      },
    },
    reportedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    lastStatusChangeAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'fault_tickets',
    indexes: [
      { fields: ['pileId', 'faultCode', 'reportedAt'] },
      { fields: ['status'] },
    ],
  }
);

export default FaultTicket;
