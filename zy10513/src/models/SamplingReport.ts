import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/connection';

export interface SamplingReportAttributes {
  id: string;
  batchId: string;
  reportNo: string;
  name: string;
  summary?: string;
  statistics: {
    totalRecords: number;
    sampledCount: number;
    samplingRate: number;
    reviewedCount: number;
    passCount: number;
    failCount: number;
    pendingReview: number;
    passRate: number;
    exceptionCount: number;
  };
  filePath?: string;
  fileType: string;
  generatedBy: string;
  generatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface SamplingReportCreationAttributes
  extends Optional<SamplingReportAttributes, 'id' | 'generatedAt' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class SamplingReport
  extends Model<SamplingReportAttributes, SamplingReportCreationAttributes>
  implements SamplingReportAttributes {
  public id!: string;
  public batchId!: string;
  public reportNo!: string;
  public name!: string;
  public summary?: string;
  public statistics!: {
    totalRecords: number;
    sampledCount: number;
    samplingRate: number;
    reviewedCount: number;
    passCount: number;
    failCount: number;
    pendingReview: number;
    passRate: number;
    exceptionCount: number;
  };
  public filePath?: string;
  public fileType!: string;
  public generatedBy!: string;
  public generatedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date;
}

SamplingReport.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    batchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'sampling_batches',
        key: 'id',
      },
    },
    reportNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    statistics: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    fileType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'excel',
    },
    generatedBy: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    generatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'sampling_reports',
    modelName: 'SamplingReport',
    indexes: [
      {
        fields: ['batch_id'],
      },
    ],
  }
);

export default SamplingReport;
