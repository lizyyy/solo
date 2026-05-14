import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { RefundMethod } from '../types';

class RefundRecordModel extends Model {
  public id!: string;
  public afterSalesId!: string;
  public method!: RefundMethod;
  public amount!: number;
  public transactionId?: string;
  public status!: string;
  public retryCount!: number;
  public errorMessage?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RefundRecordModel.init(
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
    method: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    transactionId: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'refund_records',
    timestamps: true,
  }
);

export default RefundRecordModel;