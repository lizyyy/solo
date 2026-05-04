const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '订单ID'
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '商品ID'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '订购数量'
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '单价'
  },
  allocated_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已分配库存数量'
  },
  picked_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已自提数量'
  },
  refunded_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已退款数量'
  },
  status: {
    type: DataTypes.ENUM('pending', 'allocated', 'partial_allocated', 'picked', 'partial_picked', 'refunded', 'partial_refunded'),
    defaultValue: 'pending',
    comment: '状态：待分配、已分配、部分分配、已自提、部分自提、已退款、部分退款'
  },
  note: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  tableName: 'order_items',
  comment: '订单商品明细表'
});

module.exports = OrderItem;
