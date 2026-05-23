const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliveryNote = sequelize.define('DeliveryNote', {
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
  noteNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '送货单号'
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '商品名称'
  },
  productCode: {
    type: DataTypes.STRING,
    comment: '商品编码'
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '送货数量'
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'kg',
    comment: '单位'
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '单价'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '总金额'
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
  tableName: 'delivery_notes',
  indexes: [
    { fields: ['batch_id'] },
    { fields: ['note_no'], unique: true },
    { fields: ['status'] }
  ]
});

module.exports = DeliveryNote;
