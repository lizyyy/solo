const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const STORAGE_STATUSES = {
  NORMAL: 'normal',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
  EXPIRED: 'expired',
  DAMAGED: 'damaged'
};

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  batch_no: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '批次号'
  },
  reagent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '试剂ID'
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '当前数量'
  },
  original_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '原始入库数量'
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '存放位置'
  },
  production_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '生产日期'
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '有效期至'
  },
  supplier: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '供应商'
  },
  purchase_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '采购单价'
  },
  status: {
    type: DataTypes.ENUM(Object.values(STORAGE_STATUSES)),
    allowNull: false,
    defaultValue: STORAGE_STATUSES.NORMAL,
    comment: '库存状态'
  },
  warning_threshold: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '预警阈值'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'inventory',
  comment: '库存表'
});

Inventory.STORAGE_STATUSES = STORAGE_STATUSES;

module.exports = Inventory;
