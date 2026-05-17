import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/connection';

export interface ReviewerAttributes {
  id: string;
  userId: string;
  username: string;
  email?: string;
  department?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface ReviewerCreationAttributes
  extends Optional<ReviewerAttributes, 'id' | 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class Reviewer
  extends Model<ReviewerAttributes, ReviewerCreationAttributes>
  implements ReviewerAttributes {
  public id!: string;
  public userId!: string;
  public username!: string;
  public email?: string;
  public department?: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date;
}

Reviewer.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'reviewers',
    modelName: 'Reviewer',
  }
);

export default Reviewer;
