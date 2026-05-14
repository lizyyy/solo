import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export enum DatasetStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  DEPRECATED = 'deprecated',
}

export interface IDatasetVersion {
  id: string;
  version: string;
  name: string;
  description?: string;
  status: DatasetStatus;
  recordCount: number;
  importOrder: number;
  schema?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

class DatasetVersion extends Model<IDatasetVersion> implements IDatasetVersion {
  public id!: string;
  public version!: string;
  public name!: string;
  public description?: string;
  public status!: DatasetStatus;
  public recordCount!: number;
  public importOrder!: number;
  public schema?: Record<string, any>;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DatasetVersion.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    version: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(DatasetStatus)),
      allowNull: false,
      defaultValue: DatasetStatus.DRAFT,
    },
    recordCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    importOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    schema: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'dataset_versions',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['name', 'version'],
      },
    ],
  }
);

export { DatasetVersion };
