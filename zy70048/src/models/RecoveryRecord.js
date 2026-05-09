const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RecoveryRecord = sequelize.define('RecoveryRecord', {
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
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '复产开始时间'
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '复产完成时间'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '复产操作人'
  },
  actions: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '采取的复产措施'
  },
  verificationItems: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '验证项目和结果(JSON)'
  },
  status: {
    type: DataTypes.ENUM,
    values: ['STARTED', 'IN_PROGRESS', 'VERIFYING', 'COMPLETED', 'FAILED'],
    defaultValue: 'STARTED',
    comment: '复产状态'
  },
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '失败原因'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: '版本号'
  }
}, {
  tableName: 'recovery_records',
  timestamps: true,
  paranoid: true,
  hooks: {
    beforeUpdate: (record) => {
      record.version += 1;
    }
  }
});

module.exports = RecoveryRecord;
