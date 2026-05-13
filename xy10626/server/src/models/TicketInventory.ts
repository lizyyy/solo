import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

interface TicketInventoryAttributes {
  id: string;
  ticketGrade: string;
  price: number;
  totalQuantity: number;
  usedQuantity: number;
  lockedQuantity: number;
  availableQuantity: number;
  status: 'active' | 'suspended' | 'sold_out';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TicketInventoryCreationAttributes extends Optional<TicketInventoryAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class TicketInventory extends Model<TicketInventoryAttributes, TicketInventoryCreationAttributes> implements TicketInventoryAttributes {
  public id!: string;
  public ticketGrade!: string;
  public price!: number;
  public totalQuantity!: number;
  public usedQuantity!: number;
  public lockedQuantity!: number;
  public availableQuantity!: number;
  public status!: 'active' | 'suspended' | 'sold_out';
  public createdBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TicketInventory.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  ticketGrade: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  usedQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lockedQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  availableQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'sold_out'),
    allowNull: false,
    defaultValue: 'active'
  },
  createdBy: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'TicketInventory',
  tableName: 'ticket_inventories',
  timestamps: true
});

export default TicketInventory;
