const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Risk extends Model {}

Risk.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  riskType: {
    type: DataTypes.ENUM,
    values: [
      'CONTINUOUS_ANOMALY',
      'REPEATED_OVERLIMIT',
      'NO_RECOVERY_AFTER_TREATMENT'
    ],
    field: 'risk_type',
    allowNull: false,
    comment: '风险类型：连续异常、反复超标、补药后未恢复'
  },
  samplePoint: {
    type: DataTypes.STRING,
    field: 'sample_point',
    allowNull: false,
    comment: '采样点名称'
  },
  affectedSampleIds: {
    type: DataTypes.TEXT,
    field: 'affected_sample_ids',
    allowNull: false,
    comment: '关联的采样数据ID数组（JSON格式）',
    get() {
      const value = this.getDataValue('affectedSampleIds');
      return value ? JSON.parse(value) : [];
    },
    set(value) {
      this.setDataValue('affectedSampleIds', JSON.stringify(value));
    }
  },
  affectedParameter: {
    type: DataTypes.STRING,
    field: 'affected_parameter',
    allowNull: false,
    comment: '受影响的参数：chlorine, ph, turbidity, temperature'
  },
  startTime: {
    type: DataTypes.DATE,
    field: 'start_time',
    allowNull: false,
    comment: '风险开始时间'
  },
  endTime: {
    type: DataTypes.DATE,
    field: 'end_time',
    allowNull: true,
    comment: '风险结束时间（如果已结束）'
  },
  severity: {
    type: DataTypes.ENUM,
    values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    allowNull: false,
    defaultValue: 'MEDIUM',
    comment: '风险严重程度'
  },
  status: {
    type: DataTypes.ENUM,
    values: ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED', 'REVISED'],
    allowNull: false,
    defaultValue: 'PENDING',
    comment: '状态：待处理、复核中、已解决、已忽略、已改判'
  },
  revisedStatus: {
    type: DataTypes.ENUM,
    values: ['NORMAL', 'MINOR', 'NO_RISK'],
    field: 'revised_status',
    allowNull: true,
    comment: '改判后的状态'
  },
  revisedReason: {
    type: DataTypes.TEXT,
    field: 'revised_reason',
    allowNull: true,
    comment: '改判原因'
  },
  revisedBy: {
    type: DataTypes.STRING,
    field: 'revised_by',
    allowNull: true,
    comment: '改判人员'
  },
  revisedAt: {
    type: DataTypes.DATE,
    field: 'revised_at',
    allowNull: true,
    comment: '改判时间'
  },
  treatmentResult: {
    type: DataTypes.TEXT,
    field: 'treatment_result',
    allowNull: true,
    comment: '处理结果'
  },
  treatedBy: {
    type: DataTypes.STRING,
    field: 'treated_by',
    allowNull: true,
    comment: '处理人员'
  },
  treatedAt: {
    type: DataTypes.DATE,
    field: 'treated_at',
    allowNull: true,
    comment: '处理时间'
  },
  detectionTime: {
    type: DataTypes.DATE,
    field: 'detection_time',
    defaultValue: DataTypes.NOW,
    comment: '检测时间'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '风险描述'
  }
}, {
  sequelize,
  modelName: 'Risk',
  tableName: 'risks',
  indexes: [
    {
      name: 'idx_risks_risk_type',
      fields: ['risk_type']
    },
    {
      name: 'idx_risks_sample_point',
      fields: ['sample_point']
    },
    {
      name: 'idx_risks_status',
      fields: ['status']
    },
    {
      name: 'idx_risks_detection_time',
      fields: ['detection_time']
    }
  ]
});

module.exports = Risk;
