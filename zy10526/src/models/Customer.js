const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  accountId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '客户账号ID'
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '客户名称'
  },
  customerLevel: {
    type: DataTypes.ENUM('normal', 'vip', 'svip'),
    defaultValue: 'normal',
    comment: '客户等级'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'frozen'),
    defaultValue: 'active',
    comment: '账号状态'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '扩展信息'
  }
}, {
  tableName: 'customers',
  timestamps: true,
  paranoid: true
});

module.exports = Customer;
