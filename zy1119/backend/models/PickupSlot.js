const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PickupSlot = sequelize.define('PickupSlot', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  group_batch_id: {
    type: DataTypes.INTEGER,
    comment: '关联团购批次ID'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '自提日期'
  },
  start_time: {
    type: DataTypes.TIME,
    allowNull: false,
    comment: '开始时间'
  },
  end_time: {
    type: DataTypes.TIME,
    allowNull: false,
    comment: '结束时间'
  },
  max_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
    comment: '最大订单数（容量限制）'
  },
  current_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '当前订单数'
  },
  status: {
    type: DataTypes.ENUM('available', 'full', 'closed'),
    defaultValue: 'available',
    comment: '状态：可预约、已满、已关闭'
  }
}, {
  tableName: 'pickup_slots',
  comment: '自提时段表'
});

module.exports = PickupSlot;
