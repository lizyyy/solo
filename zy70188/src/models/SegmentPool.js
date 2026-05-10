const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SegmentPool = sequelize.define('segment_pool', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  segment_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '号段编码'
  },
  segment_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '号段名称'
  },
  prefix: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '号码前缀'
  },
  start_number: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '起始号码'
  },
  end_number: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '结束号码'
  },
  current_number: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
    comment: '当前已分配到的号码'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'exhausted'),
    defaultValue: 'active',
    comment: '状态：active-启用，inactive-停用，exhausted-已用完'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '描述'
  },
  created_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '创建人'
  },
  updated_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '更新人'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '版本号，用于乐观锁'
  }
}, {
  tableName: 'segment_pool',
  comment: '号段池'
});

SegmentPool.prototype.getAvailableCount = function() {
  return this.end_number - this.current_number;
};

SegmentPool.prototype.isExhausted = function() {
  return this.current_number >= this.end_number;
};

module.exports = SegmentPool;
