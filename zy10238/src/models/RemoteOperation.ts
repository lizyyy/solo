import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum OperationStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

export enum OperationCommand {
  RESTART = 'restart',
  STOP_CHARGING = 'stop_charging',
  UNLOCK_GUN = 'unlock_gun',
  RESET = 'reset',
}

interface RemoteOperationAttributes {
  id: string;
  ticketId: string;
  stationId: string;
  pileId: string;
  command: OperationCommand;
  operatorId?: string;
  operatorName?: string;
  status: OperationStatus;
  resultMessage?: string;
  requestedAt: Date;
  executedAt?: Date;
  completedAt?: Date;
}

class RemoteOperation extends Model<RemoteOperationAttributes> implements RemoteOperationAttributes {
  public id!: string;
  public ticketId!: string;
  public stationId!: string;
  public pileId!: string;
  public command!: OperationCommand;
  public operatorId?: string;
  public operatorName?: string;
  public status!: OperationStatus;
  public resultMessage?: string;
  public requestedAt!: Date;
  public executedAt?: Date;
  public completedAt?: Date;
}

RemoteOperation.init(
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
    stationId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pileId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    command: {
      type: DataTypes.ENUM(...Object.values(OperationCommand)),
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
    status: {
      type: DataTypes.ENUM(...Object.values(OperationStatus)),
      allowNull: false,
      defaultValue: OperationStatus.PENDING,
    },
    resultMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    requestedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    executedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'remote_operations',
    indexes: [
      { fields: ['ticketId'] },
      { fields: ['pileId'] },
      { fields: ['status'] },
    ],
  }
);

export default RemoteOperation;
