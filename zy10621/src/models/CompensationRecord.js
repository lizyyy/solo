const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const STATUS = {
  BOOKED: '已预约',
  RELEASE_REQUEST: '释放申请',
  RELEASED: '已释放',
  COMPENSATING: '补偿中',
  PENDING_MANUAL: '待人工处理',
  COMPLETED: '已完成',
  REJECTED: '已拒绝'
};

const RELEASE_REASONS = {
  EQUIPMENT_FAILURE: '设备故障',
  ROOM_UNAVAILABLE: '会议室不可用',
  MEETING_CANCELLED: '会议取消',
  DOUBLE_BOOKING: '重复预订',
  OTHER: '其他'
};

const CompensationRecord = sequelize.define('CompensationRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reservationId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  roomId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: STATUS.BOOKED,
    validate: {
      isIn: [Object.values(STATUS)]
    }
  },
  releaseReason: {
    type: DataTypes.STRING,
    validate: {
      isIn: [Object.values(RELEASE_REASONS)]
    }
  },
  releaseReasonDetail: {
    type: DataTypes.TEXT
  },
  affectedEquipment: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  chargedAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  compensationAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  explanation: {
    type: DataTypes.TEXT
  },
  validationErrors: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  importRowId: {
    type: DataTypes.STRING
  },
  approvedBy: {
    type: DataTypes.INTEGER
  },
  approvedAt: {
    type: DataTypes.DATE
  },
  completedAt: {
    type: DataTypes.DATE
  }
}, {
  timestamps: true
});

CompensationRecord.STATUS = STATUS;
CompensationRecord.RELEASE_REASONS = RELEASE_REASONS;

module.exports = CompensationRecord;
