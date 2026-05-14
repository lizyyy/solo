import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export enum EnvironmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}

export interface IEnvironment {
  id: string;
  name: string;
  description?: string;
  status: EnvironmentStatus;
  baseUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

class Environment extends Model<IEnvironment> implements IEnvironment {
  public id!: string;
  public name!: string;
  public description?: string;
  public status!: EnvironmentStatus;
  public baseUrl?: string;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Environment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(EnvironmentStatus)),
      allowNull: false,
      defaultValue: EnvironmentStatus.ACTIVE,
    },
    baseUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'environments',
    timestamps: true,
  }
);

export { Environment };
