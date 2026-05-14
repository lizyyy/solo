import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export enum RecordStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export interface ISeedRecord {
  id: string;
  taskId: string;
  recordId: string;
  recordData: Record<string, any>;
  status: RecordStatus;
  errorMessage?: string;
  importedAt?: Date;
  rolledBackAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class SeedRecord extends Model<ISeedRecord> implements ISeedRecord {
  public id!: string;
  public taskId!: string;
  public recordId!: string;
  public recordData!: Record<string, any>;
  public status!: RecordStatus;
  public errorMessage?: string;
  public importedAt?: Date;
  public rolledBackAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SeedRecord.init(
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
    recordId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    recordData: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(RecordStatus)),
      allowNull: false,
      defaultValue: RecordStatus.PENDING,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    importedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rolledBackAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'seed_records',
    timestamps: true,
    indexes: [
      {
        fields: ['taskId'],
      },
      {
        fields: ['recordId'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export { SeedRecord };
