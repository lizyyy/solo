const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryCheckItem = sequelize.define('InventoryCheckItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  check_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '盘点单ID'
  },
  inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '库存ID'
  },
  reagent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '试剂ID'
  },
  reagent_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '试剂名称'
  },
  batch_no: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '批次号'
  },
  expected_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '账面数量'
  },
  actual_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '实际数量'
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '单位'
  },
  difference: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '差异数量'
  },
  is_matched: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否账实相符'
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '存放位置'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '差异原因'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'inventory_check_items',
  comment: '盘点单项表'
});

module.exports = InventoryCheckItem;
