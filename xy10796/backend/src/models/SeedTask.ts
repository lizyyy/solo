import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back',
  RETRYING = 'retrying',
}

export interface ISeedTask {
  id: string;
  idempotencyKey: string;
  environmentId: string;
  datasetVersionId: string;
  status: TaskStatus;
  importOrder: number;
  retryCount: number;
  maxRetries: number;
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

class SeedTask extends Model<ISeedTask> implements ISeedTask {
  public id!: string;
  public idempotencyKey!: string;
  public environmentId!: string;
  public datasetVersionId!: string;
  public status!: TaskStatus;
  public importOrder!: number;
  public retryCount!: number;
  public maxRetries!: number;
  public totalRecords!: number;
  public successRecords!: number;
  public failedRecords!: number;
  public errorMessage?: string;
  public startedAt?: Date;
  public completedAt?: Date;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SeedTask.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    idempotencyKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    environmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'environments',
        key: 'id',
      },
    },
    datasetVersionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'dataset_versions',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TaskStatus)),
      allowNull: false,
      defaultValue: TaskStatus.PENDING,
    },
    importOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    maxRetries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    totalRecords: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    successRecords: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedRecords: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'seed_tasks',
    timestamps: true,
    indexes: [
      {
        fields: ['environmentId'],
      },
      {
        fields: ['datasetVersionId'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export { SeedTask };
