const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LineStop = sequelize.define('LineStop', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  lineCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '产线编号'
  },
  lineName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '产线名称'
  },
  stopTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '停线时间'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '记录人'
  },
  initialDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '初始描述'
  },
  status: {
    type: DataTypes.ENUM,
    values: [
      'CREATED',
      'REASON_ANALYZING',
      'REASON_CONFIRMED',
      'RESPONSIBILITY_ASSIGNED',
      'RECOVERY_IN_PROGRESS',
      'RECOVERED',
      'REVIEWING',
      'COMPLETED'
    ],
    defaultValue: 'CREATED',
    allowNull: false,
    comment: '状态'
  },
  estimatedDuration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '预估停线时长(分钟)'
  },
  actualDuration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '实际停线时长(分钟)'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: '乐观锁版本号'
  }
}, {
  tableName: 'line_stops',
  timestamps: true,
  paranoid: true,
  hooks: {
    beforeUpdate: (lineStop) => {
      lineStop.version += 1;
    }
  }
});

module.exports = LineStop;
