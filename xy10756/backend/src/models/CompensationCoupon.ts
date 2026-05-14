import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class CompensationCouponModel extends Model {
  public id!: string;
  public afterSalesId!: string;
  public couponCode!: string;
  public amount!: number;
  public status!: string;
  public userId!: string;
  public issuedAt?: Date;
  public usedAt?: Date;
  public errorMessage?: string;
  public correctionReason?: string;
  public correctionOperator?: string;
  public correctionTime?: Date;
  public retryCount!: number;
  public readonly createdAt!: Date;
}

CompensationCouponModel.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    afterSalesId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'after_sales_orders',
        key: 'id',
      },
    },
    couponCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    correctionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    correctionOperator: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    correctionTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'compensation_coupons',
    timestamps: true,
    updatedAt: false,
  }
);

export default CompensationCouponModel;