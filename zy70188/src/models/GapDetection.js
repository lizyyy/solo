const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GapDetection = sequelize.define('gap_detection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  segment_pool_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '号段池ID'
  },
  gap_start_number: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '断号起始号码'
  },
  gap_end_number: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '断号结束号码'
  },
  gap_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '断号数量'
  },
  detected_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '检测时间'
  },
  status: {
    type: DataTypes.ENUM('detected', 'investigating', 'resolved', 'ignored'),
    defaultValue: 'detected',
    comment: '状态：detected-已检测，investigating-调查中，resolved-已解决，ignored-已忽略'
  },
  resolution_type: {
    type: DataTypes.ENUM('voided', 'recovered', 'system_error', 'business_exception', 'other'),
    allowNull: true,
    comment: '解决方式：voided-已作废，recovered-已回收，system_error-系统错误，business_exception-业务异常，other-其他'
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '解决时间'
  },
  resolved_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '处理人ID'
  },
  resolution_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '解决说明'
  },
  detected_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '检测人ID，系统检测则为system'
  }
}, {
  tableName: 'gap_detection',
  comment: '断号检测记录',
  indexes: [
    {
      name: 'idx_gap_segment_pool_id',
      fields: ['segment_pool_id']
    },
    {
      name: 'idx_gap_status',
      fields: ['status']
    },
    {
      name: 'idx_gap_detected_at',
      fields: ['detected_at']
    }
  ]
});

module.exports = GapDetection;
