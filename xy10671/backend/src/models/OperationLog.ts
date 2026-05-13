import { DataTypes, Model } from 'sequelize';
import sequelize from './database';

class OperationLog extends Model {
  public id!: string;
  public projectId!: string;
  public operationType!: string;
  public operationContent!: string;
  public operator!: string;
  public operationTime!: Date;
  public fromStatus!: string;
  public toStatus!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

OperationLog.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'projects',
      key: 'id'
    }
  },
  operationType: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  operationContent: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  operator: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  operationTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  fromStatus: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  toStatus: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'OperationLog',
  tableName: 'operation_logs'
});

export default OperationLog;
