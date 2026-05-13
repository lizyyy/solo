import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

interface WaitlistQueueAttributes {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  ticketGrade: string;
  quantity: number;
  priority: number;
  status: 'pending' | 'processing' | 'confirmed' | 'paid' | 'cancelled' | 'failed';
  assignedSeats: string;
  isLocked: boolean;
  lockedBy: string;
  lockedAt: Date;
  paidAt: Date;
  processedBy: string;
  remark: string;
  createdAt: Date;
  updatedAt: Date;
}

interface WaitlistQueueCreationAttributes extends Optional<WaitlistQueueAttributes, 'id' | 'createdAt' | 'updatedAt' | 'isLocked' | 'assignedSeats'> {}

class WaitlistQueue extends Model<WaitlistQueueAttributes, WaitlistQueueCreationAttributes> implements WaitlistQueueAttributes {
  public id!: string;
  public orderNo!: string;
  public customerName!: string;
  public customerPhone!: string;
  public ticketGrade!: string;
  public quantity!: number;
  public priority!: number;
  public status!: 'pending' | 'processing' | 'confirmed' | 'paid' | 'cancelled' | 'failed';
  public assignedSeats!: string;
  public isLocked!: boolean;
  public lockedBy!: string;
  public lockedAt!: Date;
  public paidAt!: Date;
  public processedBy!: string;
  public remark!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

WaitlistQueue.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  orderNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  customerName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  customerPhone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  ticketGrade: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'confirmed', 'paid', 'cancelled', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  assignedSeats: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isLocked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  lockedBy: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  lockedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  processedBy: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'WaitlistQueue',
  tableName: 'waitlist_queues',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['priority'] },
    { fields: ['ticketGrade'] }
  ]
});

export default WaitlistQueue;
