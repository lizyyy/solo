import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface DeliveryLinkAttributes {
  id?: number;
  photoSelectionId: number;
  linkUrl: string;
  linkPassword?: string;
  expireTime?: Date;
  deliverer: string;
  deliveryTime?: Date;
  status: 'active' | 'expired' | 'revoked';
  downloadCount?: number;
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class DeliveryLink extends Model<DeliveryLinkAttributes> implements DeliveryLinkAttributes {
  public id!: number;
  public photoSelectionId!: number;
  public linkUrl!: string;
  public linkPassword?: string;
  public expireTime?: Date;
  public deliverer!: string;
  public deliveryTime?: Date;
  public status!: 'active' | 'expired' | 'revoked';
  public downloadCount?: number;
  public remark?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DeliveryLink.init({
  photoSelectionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  linkUrl: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  linkPassword: {
    type: DataTypes.STRING(100)
  },
  expireTime: {
    type: DataTypes.DATE
  },
  deliverer: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  deliveryTime: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'revoked'),
    defaultValue: 'active'
  },
  expireTime: {
    type: DataTypes.DATE
  },
  downloadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  remark: {
    type: DataTypes.TEXT
  }
}, {
  sequelize,
  modelName: 'DeliveryLink',
  tableName: 'delivery_links'
});

export default DeliveryLink;
