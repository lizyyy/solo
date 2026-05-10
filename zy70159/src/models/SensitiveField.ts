import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class SensitiveField extends Model {
  public id!: string;
  public fieldName!: string;
  public dataType!: string;
  public sensitivityLevel!: 'low' | 'medium' | 'high';
  public maskingRule!: 'mask_middle' | 'replace_with_asterisk' | 'hash';
  public description!: string;
}

SensitiveField.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    fieldName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dataType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sensitivityLevel: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
    },
    maskingRule: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'SensitiveField',
    timestamps: true,
  }
);

export default SensitiveField;
