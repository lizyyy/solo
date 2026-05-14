import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { AfterSalesStatus, QaResult, RefundMethod, RejectReason } from '../types';

class AfterSalesOrderModel extends Model {
  public id!: string;
  public orderNo!: string;
  public userId!: string;
  public userName!: string;
  public productName!: string;
  public amount!: number;
  public status!: AfterSalesStatus;
  public qaResult?: QaResult;
  public rejectReason?: RejectReason;
  public rejectReasonReview?: string;
  public rejectReasonReviewed!: boolean;
  public rejectReasonReviewer?: string;
  public refundMethod?: RefundMethod;
  public retryCount!: number;
  public maxRetries!: number;
  public idempotencyKey!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AfterSalesOrderModel.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    orderNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    userName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    productName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: AfterSalesStatus.CREATED,
    },
    qaResult: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    rejectReason: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    rejectReasonReview: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rejectReasonReviewed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    rejectReasonReviewer: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    refundMethod: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    maxRetries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    idempotencyKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'after_sales_orders',
    timestamps: true,
  }
);

export default AfterSalesOrderModel;