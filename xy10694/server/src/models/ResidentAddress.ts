import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface ResidentAddressAttributes {
  id: string;
  residentName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  street: string;
  community: string;
  building: string;
  unit: string;
  room: string;
  gridCode: string;
  isVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

class ResidentAddress extends Model<ResidentAddressAttributes> implements ResidentAddressAttributes {
  public id!: string;
  public residentName!: string;
  public phone!: string;
  public province!: string;
  public city!: string;
  public district!: string;
  public street!: string;
  public community!: string;
  public building!: string;
  public unit!: string;
  public room!: string;
  public gridCode!: string;
  public isVerified!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ResidentAddress.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    residentName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    province: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    district: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    street: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    community: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    building: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    room: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    gridCode: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  },
  {
    sequelize,
    modelName: 'ResidentAddress',
    tableName: 'resident_addresses'
  }
);

export default ResidentAddress;
