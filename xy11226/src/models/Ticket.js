const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ticketNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '客服单号'
  },
  customerName: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '客户姓名'
  },
  customerPhone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '客户电话'
  },
  stationId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '换电站ID'
  },
  stationName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '换电站名称'
  },
  problemType: {
    type: DataTypes.ENUM('door_error', 'scan_failure', 'empty_bin_false_alarm', 'battery_error', 'system_error', 'other'),
    allowNull: true,
    comment: '问题类型：柜门打不开、扫码失败、空仓误报、电池故障、系统故障、其他'
  },
  problemTypeLabel: {
    type: DataTypes.VIRTUAL,
    get() {
      const labels = {
        'door_error': '柜门打不开',
        'scan_failure': '扫码失败',
        'empty_bin_false_alarm': '空仓误报',
        'battery_error': '电池故障',
        'system_error': '系统故障',
        'other': '其他'
      };
      return labels[this.problemType] || '未分类';
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '问题描述'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'resolved', 'closed'),
    defaultValue: 'pending',
    comment: '状态：待处理、处理中、已解决、已关闭'
  },
  statusLabel: {
    type: DataTypes.VIRTUAL,
    get() {
      const labels = {
        'pending': '待处理',
        'processing': '处理中',
        'resolved': '已解决',
        'closed': '已关闭'
      };
      return labels[this.status] || '未知';
    }
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium',
    comment: '优先级：低、中、高、紧急'
  },
  operatorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    },
    comment: '处理人ID'
  },
  reviewerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    },
    comment: '复核人ID'
  },
  resolution: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '解决方案'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '解决时间'
  },
  source: {
    type: DataTypes.ENUM('phone', 'app', 'web', 'import'),
    defaultValue: 'import',
    comment: '来源：电话、APP、网页、导入'
  }
}, {
  tableName: 'tickets',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['ticketNo'] },
    { fields: ['stationId'] },
    { fields: ['problemType'] },
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ]
});

Ticket.belongsTo(User, { foreignKey: 'operatorId', as: 'operator' });
Ticket.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });
User.hasMany(Ticket, { foreignKey: 'operatorId', as: 'operatorTickets' });
User.hasMany(Ticket, { foreignKey: 'reviewerId', as: 'reviewerTickets' });

module.exports = Ticket;
