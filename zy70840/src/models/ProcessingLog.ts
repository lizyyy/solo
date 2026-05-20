import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export enum LogType {
  STATUS_CHANGE = 'status_change',
  CERTIFICATE_ISSUE = 'certificate_issue',
  SCHEDULE_CONFLICT = 'schedule_conflict',
  DEPOSIT_DEDUCTION = 'deposit_deduction',
  REMARK = 'remark',
  RETURNED = 'returned',
}

class ProcessingLog extends Model {
  public id!: number;
  public applicationId!: number;
  public logType!: LogType;
  public reason!: string;
  public readableReason!: string;
  public operator!: string;
  public operatedAt!: Date;
  public oldStatus!: string | null;
  public newStatus!: string | null;
  public metadata!: string | null;
}

ProcessingLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'applications',
        key: 'id',
      },
    },
    logType: {
      type: DataTypes.ENUM(...Object.values(LogType)),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    readableReason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    operator: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    operatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    oldStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    newStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON格式的附加数据',
    },
  },
  {
    sequelize,
    modelName: 'ProcessingLog',
    tableName: 'processing_logs',
    timestamps: true,
    indexes: [
      { fields: ['applicationId'] },
      { fields: ['logType'] },
      { fields: ['operatedAt'] },
    ],
  }
);

export default ProcessingLog;
