import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/connection';

export interface OriginalRecordAttributes {
  id: string;
  batchId: string;
  originalId: string;
  dataSource: string;
  content: Record<string, any>;
  rawInput: string;
  isSampled: boolean;
  samplingWeight?: number;
  sampledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface OriginalRecordCreationAttributes
  extends Optional<OriginalRecordAttributes, 'id' | 'isSampled' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class OriginalRecord
  extends Model<OriginalRecordAttributes, OriginalRecordCreationAttributes>
  implements OriginalRecordAttributes {
  public id!: string;
  public batchId!: string;
  public originalId!: string;
  public dataSource!: string;
  public content!: Record<string, any>;
  public rawInput!: string;
  public isSampled!: boolean;
  public samplingWeight?: number;
  public sampledAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date;
}

OriginalRecord.init(
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
    originalId: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    dataSource: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    content: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    rawInput: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isSampled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    samplingWeight: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    sampledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'original_records',
    modelName: 'OriginalRecord',
    indexes: [
      {
        fields: ['batch_id', 'original_id'],
        unique: true,
      },
      {
        fields: ['batch_id', 'is_sampled'],
      },
    ],
  }
);

export default OriginalRecord;
