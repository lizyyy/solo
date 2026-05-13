const { sequelize, DataTypes } = require('../database');

const LowScoreReason = sequelize.define('LowScoreReason', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '原因编码'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '原因名称'
  },
  category: {
    type: DataTypes.STRING,
    comment: '原因分类'
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序'
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  },
  needReview: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否需要复核'
  }
}, {
  tableName: 'low_score_reason',
  timestamps: true
});

module.exports = LowScoreReason;
