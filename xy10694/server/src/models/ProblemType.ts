import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface ProblemTypeAttributes {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  level: number;
  isActive: boolean;
  defaultUnitId: string | null;
  priority: number;
  createdAt?: Date;
  updatedAt?: Date;
}

class ProblemType extends Model<ProblemTypeAttributes> implements ProblemTypeAttributes {
  public id!: string;
  public name!: string;
  public code!: string;
  public parentId!: string | null;
  public level!: number;
  public isActive!: boolean;
  public defaultUnitId!: string | null;
  public priority!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ProblemType.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    defaultUnitId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    }
  },
  {
    sequelize,
    modelName: 'ProblemType',
    tableName: 'problem_types'
  }
);

export default ProblemType;
