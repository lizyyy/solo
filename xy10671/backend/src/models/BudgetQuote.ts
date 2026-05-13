import { DataTypes, Model } from 'sequelize';
import sequelize from './database';

class BudgetQuote extends Model {
  public id!: string;
  public projectId!: string;
  public itemName!: string;
  public quantity!: number;
  public unitPrice!: number;
  public totalPrice!: number;
  public supplier!: string;
  public quotationTime!: Date;
  public isApproved!: boolean;
  public approvedBy!: string;
  public approvedTime!: Date | null;
  public remarks!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BudgetQuote.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'projects',
      key: 'id'
    }
  },
  itemName: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  supplier: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  quotationTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  approvedBy: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  approvedTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'BudgetQuote',
  tableName: 'budget_quotes'
});

export default BudgetQuote;
