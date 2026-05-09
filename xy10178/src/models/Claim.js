const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Claim extends Model {}

Claim.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  caseNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '案件编号'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '赔付总金额'
  },
  status: {
    type: DataTypes.ENUM,
    values: ['PENDING', 'REVIEWING', 'ALLOCATED', 'CONFIRMED', 'PAID', 'CANCELLED'],
    defaultValue: 'PENDING',
    comment: '案件状态'
  },
  currentVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '当前版本号'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '案件描述'
  },
  lastRequestId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '最后一次请求ID，用于重复提交拦截'
  }
}, {
  sequelize,
  modelName: 'Claim',
  tableName: 'claims',
  timestamps: true
});

module.exports = Claim;
