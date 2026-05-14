import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class LedgerRecordModel extends Model {
  public id!: string;
  public afterSalesId!: string;
  public orderNo!: string;
  public type!: string;
  public amount!: number;
  public status!: string;
  public operator!: string;
  public operationTime!: Date;
  public remarks?: string;
}

LedgerRecordModel.init(
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
    orderNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    operator: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    operationTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'ledger_records',
    timestamps: false,
  }
);

export default LedgerRecordModel;