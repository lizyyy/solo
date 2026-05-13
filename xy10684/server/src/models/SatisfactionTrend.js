const { sequelize, DataTypes } = require('../database');

const SatisfactionTrend = sequelize.define('SatisfactionTrend', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  period: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '统计周期 YYYY-MM 或 YYYY-MM-DD'
  },
  periodType: {
    type: DataTypes.ENUM('daily', 'monthly'),
    defaultValue: 'daily',
    comment: '周期类型'
  },
  totalSurveys: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总回访数'
  },
  lowScoreCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '低分数量'
  },
  lowScoreRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    comment: '低分率'
  },
  avgScore: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0,
    comment: '平均评分'
  },
  remedyCompletedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '补救完成数'
  },
  remedySuccessCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '补救成功数'
  },
  remedySuccessRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    comment: '补救成功率'
  },
  departmentId: {
    type: DataTypes.INTEGER,
    comment: '部门ID'
  }
}, {
  tableName: 'satisfaction_trend',
  timestamps: true
});

module.exports = SatisfactionTrend;
