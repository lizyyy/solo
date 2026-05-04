const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Vehicle = require('./vehicle');

class Batch extends Model {}

Batch.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'batch_number',
    comment: '批次号'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '回收日期'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'reviewed', 'completed', 'flagged'),
    defaultValue: 'pending',
    comment: '状态: pending-待处理, processing-处理中, reviewed-已复核, completed-已完成, flagged-有异常'
  },
  riskLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    field: 'risk_level',
    defaultValue: 'low',
    comment: '风险等级'
  },
  totalWeight: {
    type: DataTypes.FLOAT,
    field: 'total_weight',
    defaultValue: 0,
    comment: '总重量(千克)'
  },
  storeCount: {
    type: DataTypes.INTEGER,
    field: 'store_count',
    defaultValue: 0,
    comment: '回收门店数量'
  },
  waybillCount: {
    type: DataTypes.INTEGER,
    field: 'waybill_count',
    defaultValue: 0,
    comment: '联单数量'
  },
  hasRisks: {
    type: DataTypes.BOOLEAN,
    field: 'has_risks',
    defaultValue: false,
    comment: '是否有风险'
  }
}, {
  sequelize,
  modelName: 'Batch',
  tableName: 'batches',
  comment: '批次表'
});

Batch.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
Vehicle.hasMany(Batch, { foreignKey: 'vehicleId', as: 'batches' });

module.exports = Batch;
