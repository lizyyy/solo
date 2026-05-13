import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

interface FlowRecordAttributes {
  id: string;
  waitlistId: string;
  orderNo: string;
  actionType: 'lock' | 'unlock' | 'confirm' | 'pay' | 'cancel' | 'modify_seat' | 'modify_quantity';
  operator: string;
  beforeValue: string;
  afterValue: string;
  status: 'success' | 'failed' | 'reviewing';
  remark: string;
  reviewedBy: string;
  reviewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface FlowRecordCreationAttributes extends Optional<FlowRecordAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class FlowRecord extends Model<FlowRecordAttributes, FlowRecordCreationAttributes> implements FlowRecordAttributes {
  public id!: string;
  public waitlistId!: string;
  public orderNo!: string;
  public actionType!: 'lock' | 'unlock' | 'confirm' | 'pay' | 'cancel' | 'modify_seat' | 'modify_quantity';
  public operator!: string;
  public beforeValue!: string;
  public afterValue!: string;
  public status!: 'success' | 'failed' | 'reviewing';
  public remark!: string;
  public reviewedBy!: string;
  public reviewedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FlowRecord.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  waitlistId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'waitlist_queues',
      key: 'id'
    }
  },
  orderNo: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  actionType: {
    type: DataTypes.ENUM('lock', 'unlock', 'confirm', 'pay', 'cancel', 'modify_seat', 'modify_quantity'),
    allowNull: false
  },
  operator: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  beforeValue: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  afterValue: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('success', 'failed', 'reviewing'),
    allowNull: false,
    defaultValue: 'success'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewedBy: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'FlowRecord',
  tableName: 'flow_records',
  timestamps: true,
  indexes: [
    { fields: ['waitlistId'] },
    { fields: ['actionType'] },
    { fields: ['status'] },
    { fields: ['operator'] },
    { fields: ['createdAt'] }
  ]
});

export default FlowRecord;
