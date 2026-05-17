import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/connection';

export enum BatchStatus {
  DRAFT = 'draft',
  SAMPLING = 'sampling',
  SAMPLING_COMPLETED = 'sampling_completed',
  REVIEWING = 'reviewing',
  REVIEW_COMPLETED = 'review_completed',
  REPORT_GENERATED = 'report_generated',
  ARCHIVED = 'archived',
}

export interface SamplingBatchAttributes {
  id: string;
  batchNo: string;
  name: string;
  description?: string;
  status: BatchStatus;
  totalRecords: number;
  sampledCount: number;
  ruleId: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface SamplingBatchCreationAttributes
  extends Optional<SamplingBatchAttributes, 'id' | 'totalRecords' | 'sampledCount' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class SamplingBatch
  extends Model<SamplingBatchAttributes, SamplingBatchCreationAttributes>
  implements SamplingBatchAttributes {
  public id!: string;
  public batchNo!: string;
  public name!: string;
  public description?: string;
  public status!: BatchStatus;
  public totalRecords!: number;
  public sampledCount!: number;
  public ruleId!: string;
  public createdBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date;
}

SamplingBatch.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(BatchStatus)),
      allowNull: false,
      defaultValue: BatchStatus.DRAFT,
    },
    totalRecords: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    sampledCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    ruleId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'sampling_batches',
    modelName: 'SamplingBatch',
  }
);

export default SamplingBatch;
