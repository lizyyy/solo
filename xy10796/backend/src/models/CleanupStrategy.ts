import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export enum CleanupType {
  SOFT_DELETE = 'soft_delete',
  HARD_DELETE = 'hard_delete',
  ARCHIVE = 'archive',
}

export enum StrategyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FAILED = 'failed',
}

export interface ICleanupStrategy {
  id: string;
  name: string;
  description?: string;
  environmentId: string;
  cleanupType: CleanupType;
  retentionDays: number;
  status: StrategyStatus;
  lastExecutedAt?: Date;
  errorMessage?: string;
  correctionPath?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

class CleanupStrategy extends Model<ICleanupStrategy> implements ICleanupStrategy {
  public id!: string;
  public name!: string;
  public description?: string;
  public environmentId!: string;
  public cleanupType!: CleanupType;
  public retentionDays!: number;
  public status!: StrategyStatus;
  public lastExecutedAt?: Date;
  public errorMessage?: string;
  public correctionPath?: string;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CleanupStrategy.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    environmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'environments',
        key: 'id',
      },
    },
    cleanupType: {
      type: DataTypes.ENUM(...Object.values(CleanupType)),
      allowNull: false,
      defaultValue: CleanupType.SOFT_DELETE,
    },
    retentionDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(StrategyStatus)),
      allowNull: false,
      defaultValue: StrategyStatus.ACTIVE,
    },
    lastExecutedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    correctionPath: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'cleanup_strategies',
    timestamps: true,
    indexes: [
      {
        fields: ['environmentId'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export { CleanupStrategy };
