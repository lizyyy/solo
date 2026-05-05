const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TrafficTrace = sequelize.define('TrafficTrace', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '流量追踪名称'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '描述'
  },
  source: {
    type: DataTypes.ENUM('file', 'manual', 'api'),
    defaultValue: 'file',
    comment: '来源类型'
  },
  requestCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '请求总数'
  },
  data: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '流量追踪数据数组'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '元数据'
  }
}, {
  tableName: 'traffic_traces',
  comment: '流量追踪表'
});

module.exports = TrafficTrace;
