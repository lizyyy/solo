const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class DisposalRecord extends Model {}

DisposalRecord.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  riskId: {
    type: DataTypes.INTEGER,
    field: 'risk_id',
    allowNull: false,
    comment: '关联的风险ID'
  },
  sampleId: {
    type: DataTypes.INTEGER,
    field: 'sample_id',
    allowNull: true,
    comment: '关联的采样数据ID'
  },
  disposer: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '处置人员'
  },
  disposalType: {
    type: DataTypes.ENUM,
    values: [
      'CHLORINE_ADD',
      'PH_ADJUST',
      'FILTER_BACKWASH',
      'WATER_REPLACE',
      'ALGAECIDE_ADD',
      'OTHER'
    ],
    field: 'disposal_type',
    allowNull: false,
    comment: '处置类型：加氯、调pH、反冲洗过滤、换水、加除藻剂、其他'
  },
  disposalAmount: {
    type: DataTypes.FLOAT,
    field: 'disposal_amount',
    allowNull: true,
    comment: '处置用量（单位根据类型而定）'
  },
  disposalUnit: {
    type: DataTypes.STRING,
    field: 'disposal_unit',
    allowNull: true,
    comment: '用量单位'
  },
  beforeValue: {
    type: DataTypes.FLOAT,
    field: 'before_value',
    allowNull: true,
    comment: '处置前参数值'
  },
  targetValue: {
    type: DataTypes.FLOAT,
    field: 'target_value',
    allowNull: true,
    comment: '目标参数值'
  },
  afterValue: {
    type: DataTypes.FLOAT,
    field: 'after_value',
    allowNull: true,
    comment: '处置后参数值（下次采样时记录）'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '处置详细描述'
  },
  effectAssessment: {
    type: DataTypes.ENUM,
    values: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'UNKNOWN'],
    field: 'effect_assessment',
    allowNull: false,
    defaultValue: 'UNKNOWN',
    comment: '效果评估：优秀、良好、一般、差、未知'
  },
  followUpNeeded: {
    type: DataTypes.BOOLEAN,
    field: 'follow_up_needed',
    defaultValue: false,
    comment: '是否需要跟进'
  },
  followUpTime: {
    type: DataTypes.DATE,
    field: 'follow_up_time',
    allowNull: true,
    comment: '跟进时间'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  },
  disposedAt: {
    type: DataTypes.DATE,
    field: 'disposed_at',
    defaultValue: DataTypes.NOW,
    comment: '处置时间'
  }
}, {
  sequelize,
  modelName: 'DisposalRecord',
  tableName: 'disposal_records',
  indexes: [
    {
      name: 'idx_disposal_records_risk_id',
      fields: ['risk_id']
    },
    {
      name: 'idx_disposal_records_sample_id',
      fields: ['sample_id']
    },
    {
      name: 'idx_disposal_records_disposed_at',
      fields: ['disposed_at']
    }
  ]
});

module.exports = DisposalRecord;
