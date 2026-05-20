import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export enum FlowType {
  COLLECT = 'collect',
  DEDUCT = 'deduct',
  REFUND = 'refund',
}

class DepositFlow extends Model {
  public id!: number;
  public applicationId!: number;
  public flowNo!: string;
  public flowType!: FlowType;
  public amount!: number;
  public reason!: string;
  public readableReason!: string;
  public operator!: string;
  public operatedAt!: Date;
  public balanceBefore!: number;
  public balanceAfter!: number;
}

DepositFlow.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'applications',
        key: 'id',
      },
    },
    flowNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    flowType: {
      type: DataTypes.ENUM(...Object.values(FlowType)),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    readableReason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    operator: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    operatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    balanceBefore: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'DepositFlow',
    tableName: 'deposit_flows',
    timestamps: true,
    indexes: [
      { fields: ['applicationId'] },
      { fields: ['flowType'] },
      { fields: ['operatedAt'] },
    ],
  }
);

export default DepositFlow;
