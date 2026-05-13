import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface ExtraChargeAttributes {
  id?: number;
  photoSelectionId: number;
  chargeType: 'additional_photo' | 'urgent' | 'special_effect' | 'other';
  amount: number;
  description: string;
  charger: string;
  chargeTime?: Date;
  status: 'pending' | 'confirmed' | 'paid';
  payer?: string;
  payTime?: Date;
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class ExtraCharge extends Model<ExtraChargeAttributes> implements ExtraChargeAttributes {
  public id!: number;
  public photoSelectionId!: number;
  public chargeType!: 'additional_photo' | 'urgent' | 'special_effect' | 'other';
  public amount!: number;
  public description!: string;
  public charger!: string;
  public chargeTime?: Date;
  public status!: 'pending' | 'confirmed' | 'paid';
  public payer?: string;
  public payTime?: Date;
  public remark?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ExtraCharge.init({
  photoSelectionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  chargeType: {
    type: DataTypes.ENUM('additional_photo', 'urgent', 'special_effect', 'other'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  charger: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  chargeTime: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'paid'),
    defaultValue: 'pending'
  },
  payer: {
    type: DataTypes.STRING(50)
  },
  payTime: {
    type: DataTypes.DATE
  },
  remark: {
    type: DataTypes.TEXT
  }
}, {
  sequelize,
  modelName: 'ExtraCharge',
  tableName: 'extra_charges'
});

export default ExtraCharge;
