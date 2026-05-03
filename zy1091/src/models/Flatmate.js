const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Flatmate extends Model {}

Flatmate.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '室友姓名',
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '邮箱',
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '手机号',
  },
  is_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否管理员',
  },
  points: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '当前积分余额',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'left'),
    defaultValue: 'active',
    comment: '状态：active-在住，inactive-不在住，left-已退房',
  },
  join_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '入住日期',
  },
  leave_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '退房日期',
  },
  total_debt: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '总应付金额',
  },
  total_paid: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '总已付金额',
  },
  points_used: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '积分已抵扣金额',
  },
}, {
  sequelize,
  modelName: 'Flatmate',
  tableName: 'flatmates',
  comment: '室友表',
});

module.exports = Flatmate;
