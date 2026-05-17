const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HitRecord = sequelize.define('HitRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customerWhitelistId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '客户白名单ID'
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '客户ID'
  },
  hitTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '命中时间'
  },
  hitScene: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '命中场景'
  },
  requestContext: {
    type: DataTypes.JSON,
    comment: '请求上下文'
  },
  hitResult: {
    type: DataTypes.ENUM('passed', 'blocked', 'review'),
    allowNull: false,
    comment: '命中结果'
  },
  matchDetails: {
    type: DataTypes.JSON,
    comment: '匹配详情'
  },
  hitRuleSnapshot: {
    type: DataTypes.JSON,
    comment: '命中规则快照'
  },
  operator: {
    type: DataTypes.STRING,
    comment: '操作人'
  }
}, {
  tableName: 'hit_records',
  timestamps: true
});

module.exports = HitRecord;
