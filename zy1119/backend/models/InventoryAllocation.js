const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryAllocation = sequelize.define('InventoryAllocation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '订单项ID'
  },
  inventory_batch_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '库存批次ID'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '分配数量'
  },
  picked_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已自提数量'
  },
  is_expiry_priority: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否为临期优先分配'
  },
  allocated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '分配时间'
  }
}, {
  tableName: 'inventory_allocations',
  comment: '库存分配明细表'
});

module.exports = InventoryAllocation;
