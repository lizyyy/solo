const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_no: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    comment: '订单号'
  },
  group_batch_id: {
    type: DataTypes.INTEGER,
    comment: '关联团购批次ID'
  },
  customer_name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '客户姓名'
  },
  customer_phone: {
    type: DataTypes.STRING,
    comment: '客户电话'
  },
  customer_address: {
    type: DataTypes.STRING,
    comment: '客户地址（备注）'
  },
  pickup_slot_id: {
    type: DataTypes.INTEGER,
    comment: '自提时段ID'
  },
  pickup_code: {
    type: DataTypes.STRING,
    comment: '自提码'
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '订单总金额'
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'allocated', 'picked', 'cancelled', 'refunded', 'partial_refunded'),
    defaultValue: 'pending',
    comment: '状态：待支付、已支付、已分配库存、已自提、已取消、已退款、部分退款'
  },
  pickup_time: {
    type: DataTypes.DATE,
    comment: '实际自提时间'
  },
  note: {
    type: DataTypes.TEXT,
    comment: '订单备注'
  }
}, {
  tableName: 'orders',
  comment: '订单表'
});

module.exports = Order;
