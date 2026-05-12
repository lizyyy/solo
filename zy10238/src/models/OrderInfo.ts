import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum OrderStatus {
  PENDING = 'pending',
  CHARGING = 'charging',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUND_PENDING = 'refund_pending',
  REFUNDED = 'refunded',
  REFUND_REJECTED = 'refund_rejected',
}

interface OrderInfoAttributes {
  id: string;
  orderCode: string;
  stationId: string;
  pileId: string;
  userId: string;
  startTime?: Date;
  endTime?: Date;
  chargedKwh?: number;
  totalAmount?: number;
  status: OrderStatus;
  failureReason?: string;
  refundRequestedAt?: Date;
  refundCompletedAt?: Date;
  refundAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

class OrderInfo extends Model<OrderInfoAttributes> implements OrderInfoAttributes {
  public id!: string;
  public orderCode!: string;
  public stationId!: string;
  public pileId!: string;
  public userId!: string;
  public startTime?: Date;
  public endTime?: Date;
  public chargedKwh?: number;
  public totalAmount?: number;
  public status!: OrderStatus;
  public failureReason?: string;
  public refundRequestedAt?: Date;
  public refundCompletedAt?: Date;
  public refundAmount?: number;
  public createdAt!: Date;
  public updatedAt!: Date;
}

OrderInfo.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    orderCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    stationId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pileId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    chargedKwh: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(OrderStatus)),
      allowNull: false,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refundRequestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    refundCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    refundAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'order_infos',
    indexes: [
      { fields: ['orderCode'] },
      { fields: ['pileId'] },
      { fields: ['status'] },
    ],
  }
);

export default OrderInfo;
