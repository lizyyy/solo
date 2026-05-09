const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReviewReport = sequelize.define('ReviewReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  lineStopId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '停线事件ID'
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '事件概述'
  },
  rootCause: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '根因分析'
  },
  impactAnalysis: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '影响分析'
  },
  correctiveActions: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '纠正措施'
  },
  preventiveActions: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '预防措施'
  },
  learnedLessons: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '经验教训'
  },
  preparedBy: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '报告起草人'
  },
  preparedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '起草时间'
  },
  approvedBy: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '审批人'
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '审批时间'
  },
  status: {
    type: DataTypes.ENUM,
    values: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
    defaultValue: 'DRAFT',
    comment: '报告状态'
  },
  reviewComments: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '评审意见'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: '版本号'
  }
}, {
  tableName: 'review_reports',
  timestamps: true,
  paranoid: true,
  hooks: {
    beforeUpdate: (report) => {
      report.version += 1;
    }
  }
});

module.exports = ReviewReport;
