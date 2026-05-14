import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { QaResult } from '../types';

class QaRecordModel extends Model {
  public id!: string;
  public afterSalesId!: string;
  public inspectorId!: string;
  public inspectorName!: string;
  public result!: QaResult;
  public remarks?: string;
  public defectImages?: string;
  public readonly createdAt!: Date;
}

QaRecordModel.init(
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
    inspectorId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    inspectorName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    result: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    defectImages: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'qa_records',
    timestamps: true,
    updatedAt: false,
  }
);

export default QaRecordModel;