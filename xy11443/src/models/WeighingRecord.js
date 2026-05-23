const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WeighingRecord = sequelize.define('WeighingRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '批次ID'
  },
  recordNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '称重记录号'
  },
  weighType: {
    type: DataTypes.ENUM('gross', 'tare', 'net', 'sorting'),
    allowNull: false,
    comment: '称重类型：毛重、皮重、净重、分拣后称重'
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '商品名称'
  },
  weight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '重量'
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'kg',
    comment: '单位'
  },
  weighTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '称重时间'
  },
  operator: {
    type: DataTypes.STRING,
    comment: '称重操作员'
  },
  deviceId: {
    type: DataTypes.STRING,
    comment: '称重设备ID'
  },
  status: {
    type: DataTypes.ENUM('active', 'withdrawn', 'replaced'),
    defaultValue: 'active',
    comment: '状态'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '版本号'
  },
  previousId: {
    type: DataTypes.UUID,
    comment: '上一版本ID'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '创建人'
  }
}, {
  tableName: 'weighing_records',
  indexes: [
    { fields: ['batch_id'] },
    { fields: ['record_no'], unique: true },
    { fields: ['weigh_type'] },
    { fields: ['status'] }
  ]
});

module.exports = WeighingRecord;
