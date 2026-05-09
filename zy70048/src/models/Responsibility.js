const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Responsibility = sequelize.define('Responsibility', {
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
  responsibleDepartment: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '责任部门'
  },
  responsiblePerson: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '责任人'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '责任原因说明'
  },
  severity: {
    type: DataTypes.ENUM,
    values: ['MINOR', 'MEDIUM', 'MAJOR', 'CRITICAL'],
    defaultValue: 'MEDIUM',
    comment: '严重程度'
  },
  correctiveAction: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '纠正措施'
  },
  preventiveAction: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '预防措施'
  },
  confirmedBy: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '确认人'
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '确认时间'
  },
  status: {
    type: DataTypes.ENUM,
    values: ['PENDING', 'CONFIRMED', 'APPEALED', 'FINALIZED'],
    defaultValue: 'CONFIRMED',
    comment: '责任状态'
  },
  appealReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '申诉原因'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: '版本号'
  }
}, {
  tableName: 'responsibilities',
  timestamps: true,
  paranoid: true,
  hooks: {
    beforeUpdate: (resp) => {
      resp.version += 1;
    }
  }
});

module.exports = Responsibility;
