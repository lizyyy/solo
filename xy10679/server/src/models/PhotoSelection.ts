import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface PhotoSelectionAttributes {
  id?: number;
  orderNo: string;
  customerName: string;
  photoCount: number;
  selectedCount: number;
  status: 'pending' | 'selected' | 'processing' | 'completed';
  handler: string;
  handleTime?: Date;
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class PhotoSelection extends Model<PhotoSelectionAttributes> implements PhotoSelectionAttributes {
  public id!: number;
  public orderNo!: string;
  public customerName!: string;
  public photoCount!: number;
  public selectedCount!: number;
  public status!: 'pending' | 'selected' | 'processing' | 'completed';
  public handler!: string;
  public handleTime?: Date;
  public remark?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PhotoSelection.init({
  orderNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  customerName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  photoCount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  selectedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('pending', 'selected', 'processing', 'completed'),
    defaultValue: 'pending'
  },
  handler: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  handleTime: {
    type: DataTypes.DATE
  },
  remark: {
    type: DataTypes.TEXT
  }
}, {
  sequelize,
  modelName: 'PhotoSelection',
  tableName: 'photo_selections'
});

export default PhotoSelection;
