import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export enum ImportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed'
}

export class ImportBatch extends Model {
  public id!: string;
  public fileName!: string;
  public totalRecords!: number;
  public successCount!: number;
  public failureCount!: number;
  public status!: ImportStatus;
  public errorLog?: string;
  public importedBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ImportBatch.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    totalRecords: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    successCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    failureCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ImportStatus)),
      allowNull: false,
      defaultValue: ImportStatus.PENDING
    },
    errorLog: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    importedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  },
  {
    sequelize,
    modelName: 'ImportBatch',
    tableName: 'import_batches',
    indexes: [
      { name: 'import_batches_status_idx', fields: ['status'] },
      { name: 'import_batches_imported_by_idx', fields: ['importedBy'] },
      { name: 'import_batches_created_at_idx', fields: ['createdAt'] }
    ]
  }
);
