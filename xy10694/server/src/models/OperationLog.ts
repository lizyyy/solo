import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  ASSIGN = 'assign',
  PROCESS = 'process',
  COMPLETE = 'complete',
  REVIEW = 'review',
  BLOCK = 'block',
  FOLLOW_UP = 'follow_up',
  EXPORT = 'export'
}

interface OperationLogAttributes {
  id: string;
  workOrderId: string | null;
  operationType: OperationType;
  operatorId: string;
  operatorName: string;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class OperationLog extends Model<OperationLogAttributes> implements OperationLogAttributes {
  public id!: string;
  public workOrderId!: string | null;
  public operationType!: OperationType;
  public operatorId!: string;
  public operatorName!: string;
  public description!: string;
  public ipAddress!: string | null;
  public userAgent!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

OperationLog.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    workOrderId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    operationType: {
      type: DataTypes.ENUM(...Object.values(OperationType)),
      allowNull: false
    },
    operatorId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    operatorName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    ipAddress: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'OperationLog',
    tableName: 'operation_logs'
  }
);

export default OperationLog;
