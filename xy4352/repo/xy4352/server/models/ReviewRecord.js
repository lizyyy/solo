const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ReviewRecord extends Model {}

ReviewRecord.init({
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
  reviewer: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '复核人员'
  },
  reviewType: {
    type: DataTypes.ENUM,
    values: ['INITIAL', 'FOLLOW_UP', 'FINAL'],
    field: 'review_type',
    allowNull: false,
    defaultValue: 'INITIAL',
    comment: '复核类型：初次复核、跟进复核、最终复核'
  },
  reviewResult: {
    type: DataTypes.ENUM,
    values: ['CONFIRM', 'DISMISS', 'REVISE', 'NEED_MORE_INFO'],
    field: 'review_result',
    allowNull: false,
    comment: '复核结果：确认风险、忽略风险、改判、需要更多信息'
  },
  revisedRiskLevel: {
    type: DataTypes.ENUM,
    values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    field: 'revised_risk_level',
    allowNull: true,
    comment: '改判后的风险级别'
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '复核意见'
  },
  nextReviewTime: {
    type: DataTypes.DATE,
    field: 'next_review_time',
    allowNull: true,
    comment: '下次复核时间'
  },
  reviewedAt: {
    type: DataTypes.DATE,
    field: 'reviewed_at',
    defaultValue: DataTypes.NOW,
    comment: '复核时间'
  }
}, {
  sequelize,
  modelName: 'ReviewRecord',
  tableName: 'review_records',
  indexes: [
    {
      name: 'idx_review_records_risk_id',
      fields: ['risk_id']
    },
    {
      name: 'idx_review_records_reviewed_at',
      fields: ['reviewed_at']
    }
  ]
});

module.exports = ReviewRecord;
