const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PriorityUser = sequelize.define('PriorityUser', {
  id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('school', 'government', 'industrial', 'commercial', 'vital_facility', 'senior_center'),
    allowNull: false
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  priorityLevel: {
    type: DataTypes.ENUM('1', '2', '3'),
    allowNull: false,
    defaultValue: '3',
    comment: '优先级(1最高, 3普通)'
  },
  networkNodeId: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '供水节点ID'
  },
  waterDemand: {
    type: DataTypes.FLOAT,
    comment: '日用水量(m³)'
  },
  contactPerson: {
    type: DataTypes.STRING(50),
    comment: '联系人'
  },
  contactPhone: {
    type: DataTypes.STRING(20),
    comment: '联系电话'
  }
}, {
  timestamps: true,
  tableName: 'priority_users'
});

module.exports = PriorityUser;