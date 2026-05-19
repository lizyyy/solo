const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Ticket = require('./Ticket');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作类型：create, update, delete, classify, review, export, import'
  },
  module: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '模块：ticket, user, role, system'
  },
  recordId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '记录ID'
  },
  operatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    },
    comment: '操作人ID'
  },
  oldValues: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '旧值，JSON格式',
    get() {
      const rawValue = this.getDataValue('oldValues');
      return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
      this.setDataValue('oldValues', value ? JSON.stringify(value) : null);
    }
  },
  newValues: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '新值，JSON格式',
    get() {
      const rawValue = this.getDataValue('newValues');
      return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
      this.setDataValue('newValues', value ? JSON.stringify(value) : null);
    }
  },
  ipAddress: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'IP地址'
  },
  userAgent: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '用户代理'
  },
  remark: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['action'] },
    { fields: ['module'] },
    { fields: ['operatorId'] },
    { fields: ['createdAt'] }
  ]
});

AuditLog.belongsTo(User, { foreignKey: 'operatorId', as: 'operator' });
User.hasMany(AuditLog, { foreignKey: 'operatorId' });

module.exports = AuditLog;
