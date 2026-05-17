import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/connection';

export enum ExceptionType {
  SAMPLING_ERROR = 'sampling_error',
  REVIEW_ERROR = 'review_error',
  DATA_IMPORT_ERROR = 'data_import_error',
  REPORT_ERROR = 'report_error',
  SYSTEM_ERROR = 'system_error',
}

export enum ExceptionStatus {
  OPEN = 'open',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
}

export interface ExceptionLogAttributes {
  id: string;
  batchId?: string;
  originalRecordId?: string;
  type: ExceptionType;
  status: ExceptionStatus;
  errorMessage: string;
  errorStack?: string;
  rawInput?: string;
  processingBasis?: string;
  assignedTo?: string;
  resolvedAt?: Date;
  resolution?: string;
  resolvedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface ExceptionLogCreationAttributes
  extends Optional<ExceptionLogAttributes, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class ExceptionLog
  extends Model<ExceptionLogAttributes, ExceptionLogCreationAttributes>
  implements ExceptionLogAttributes {
  public id!: string;
  public batchId?: string;
  public originalRecordId?: string;
  public type!: ExceptionType;
  public status!: ExceptionStatus;
  public errorMessage!: string;
  public errorStack?: string;
  public rawInput?: string;
  public processingBasis?: string;
  public assignedTo?: string;
  public resolvedAt?: Date;
  public resolution?: string;
  public resolvedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date;
}

ExceptionLog.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    batchId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'sampling_batches',
        key: 'id',
      },
    },
    originalRecordId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'original_records',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM(...Object.values(ExceptionType)),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ExceptionStatus)),
      allowNull: false,
      defaultValue: ExceptionStatus.OPEN,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    errorStack: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rawInput: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    processingBasis: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    assignedTo: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resolution: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolvedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'exception_logs',
    modelName: 'ExceptionLog',
    indexes: [
      {
        fields: ['batch_id', 'status'],
      },
      {
        fields: ['type', 'status'],
      },
    ],
  }
);

export default ExceptionLog;
