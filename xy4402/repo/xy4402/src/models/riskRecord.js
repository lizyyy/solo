const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Batch = require('./batch');

class RiskRecord extends Model {}

RiskRecord.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  riskType: {
    type: DataTypes.ENUM(
      'duplicate_weighing',
      'store_mismatch',
      'gps_not_at_store',
      'time_overdue',
      'suspicious_dumping',
      'weight_anomaly'
    ),
    field: 'risk_type',
    allowNull: false,
    comment: '风险类型: duplicate_weighing-重复称重, store_mismatch-门店不匹配, gps_not_at_store-轨迹未到店, time_overdue-超时回收, suspicious_dumping-疑似偷倒, weight_anomaly-重量异常'
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false,
    defaultValue: 'medium',
    comment: '风险严重程度'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '风险描述'
  },
  details: {
    type: DataTypes.TEXT,
    comment: '详细信息JSON'
  },
  detectedAt: {
    type: DataTypes.DATE,
    field: 'detected_at',
    comment: '检测时间'
  },
  isResolved: {
    type: DataTypes.BOOLEAN,
    field: 'is_resolved',
    defaultValue: false,
    comment: '是否已解决'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    field: 'resolved_at',
    comment: '解决时间'
  },
  resolvedBy: {
    type: DataTypes.STRING,
    field: 'resolved_by',
    comment: '解决人'
  },
  resolutionNote: {
    type: DataTypes.TEXT,
    field: 'resolution_note',
    comment: '解决说明'
  }
}, {
  sequelize,
  modelName: 'RiskRecord',
  tableName: 'risk_records',
  comment: '风险记录表'
});

RiskRecord.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });
Batch.hasMany(RiskRecord, { foreignKey: 'batchId', as: 'riskRecords' });

module.exports = RiskRecord;
