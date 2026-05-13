import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface GridWorkerAttributes {
  id: string;
  name: string;
  phone: string;
  employeeId: string;
  gridCodes: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

class GridWorker extends Model<GridWorkerAttributes> implements GridWorkerAttributes {
  public id!: string;
  public name!: string;
  public phone!: string;
  public employeeId!: string;
  public gridCodes!: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GridWorker.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    employeeId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    gridCodes: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    sequelize,
    modelName: 'GridWorker',
    tableName: 'grid_workers'
  }
);

export default GridWorker;
