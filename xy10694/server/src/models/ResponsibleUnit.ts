import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface ResponsibleUnitAttributes {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  contactPhone: string;
  parentId: string | null;
  level: number;
  isActive: boolean;
  canHandleTypes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class ResponsibleUnit extends Model<ResponsibleUnitAttributes> implements ResponsibleUnitAttributes {
  public id!: string;
  public name!: string;
  public code!: string;
  public contactPerson!: string;
  public contactPhone!: string;
  public parentId!: string | null;
  public level!: number;
  public isActive!: boolean;
  public canHandleTypes!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ResponsibleUnit.init(
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
    contactPerson: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    contactPhone: {
      type: DataTypes.STRING(20),
      allowNull: false
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
    canHandleTypes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'ResponsibleUnit',
    tableName: 'responsible_units'
  }
);

export default ResponsibleUnit;
