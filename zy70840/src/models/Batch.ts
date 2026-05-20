import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export enum BatchStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
}

class Batch extends Model {
  public id!: number;
  public batchNo!: string;
  public name!: string;
  public status!: BatchStatus;
  public totalCount!: number;
  public successCount!: number;
  public failCount!: number;
  public importedBy!: string;
  public importedAt!: Date;
  public remark!: string;
}

Batch.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    batchNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(BatchStatus)),
      allowNull: false,
      defaultValue: BatchStatus.PENDING,
    },
    totalCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    successCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    importedBy: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    importedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    remark: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Batch',
    tableName: 'batches',
    timestamps: true,
  }
);

export default Batch;
