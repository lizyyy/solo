import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export enum RollbackStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVIEWED = 'reviewed',
}

export interface IRollbackRecord {
  id: string;
  taskId: string;
  reason: string;
  reviewedBy?: string;
  reviewComment?: string;
  status: RollbackStatus;
  rolledBackRecords: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  reviewedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

class RollbackRecord extends Model<IRollbackRecord> implements IRollbackRecord {
  public id!: string;
  public taskId!: string;
  public reason!: string;
  public reviewedBy?: string;
  public reviewComment?: string;
  public status!: RollbackStatus;
  public rolledBackRecords!: number;
  public errorMessage?: string;
  public startedAt?: Date;
  public completedAt?: Date;
  public reviewedAt?: Date;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RollbackRecord.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    taskId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'seed_tasks',
        key: 'id',
      },
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    reviewedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    reviewComment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(RollbackStatus)),
      allowNull: false,
      defaultValue: RollbackStatus.PENDING,
    },
    rolledBackRecords: {
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
    reviewedAt: {
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
    tableName: 'rollback_records',
    timestamps: true,
    indexes: [
      {
        fields: ['taskId'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export { RollbackRecord };
