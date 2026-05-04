const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryBatch = sequelize.define('InventoryBatch', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  batch_no: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    comment: '库存批次号'
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '商品ID'
  },
  group_batch_id: {
    type: DataTypes.INTEGER,
    comment: '关联团购批次ID'
  },
  supplier_name: {
    type: DataTypes.STRING,
    comment: '供应商名称'
  },
  supplier_batch_no: {
    type: DataTypes.STRING,
    comment: '供应商批次号'
  },
  production_date: {
    type: DataTypes.DATEONLY,
    comment: '生产日期'
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    comment: '保质期截止日期'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '到货数量'
  },
  allocated_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已分配数量'
  },
  picked_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已自提数量'
  },
  freezer_id: {
    type: DataTypes.INTEGER,
    comment: '存放冰柜ID'
  },
  freezer_unit: {
    type: DataTypes.STRING,
    comment: '冰柜存储单位：件/盒等，用于容量计算'
  },
  status: {
    type: DataTypes.ENUM('in_stock', 'allocated', 'partial_allocated', 'depleted', 'expired'),
    defaultValue: 'in_stock',
    comment: '状态：在库、已全部分配、部分分配、已耗尽、已过期'
  },
  note: {
    type: DataTypes.TEXT,
    comment: '备注，如临期标记、质量问题等'
  }
}, {
  tableName: 'inventory_batches',
  comment: '库存批次表'
});

module.exports = InventoryBatch;
