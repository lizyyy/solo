const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AccidentRecord = sequelize.define('AccidentRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  accidentNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '事故编号'
  },
  testDriveId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '试驾记录ID'
  },
  reporterName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '报案人姓名'
  },
  reporterPhone: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '报案人电话'
  },
  reporterRole: {
    type: DataTypes.ENUM('customer', 'sales', 'other'),
    allowNull: false,
    comment: '报案人角色'
  },
  accidentTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '事故发生时间'
  },
  reportTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '报案时间'
  },
  accidentLocation: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '事故地点'
  },
  accidentType: {
    type: DataTypes.ENUM('collision', 'scratch', 'rollover', 'mechanical', 'other'),
    allowNull: false,
    comment: '事故类型'
  },
  accidentSeverity: {
    type: DataTypes.ENUM('minor', 'moderate', 'severe', 'fatal'),
    allowNull: false,
    comment: '事故严重程度'
  },
  accidentDescription: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '事故描述'
  },
  weatherCondition: {
    type: DataTypes.STRING,
    comment: '天气情况'
  },
  roadCondition: {
    type: DataTypes.STRING,
    comment: '道路状况'
  },
  driverName: {
    type: DataTypes.STRING,
    comment: '驾驶员姓名'
  },
  passengerCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '乘车人数'
  },
  hasInjury: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否有人员受伤'
  },
  injuryDescription: {
    type: DataTypes.TEXT,
    comment: '受伤情况描述'
  },
  vehicleDamage: {
    type: DataTypes.TEXT,
    comment: '车辆损坏情况'
  },
  otherVehicleDamage: {
    type: DataTypes.TEXT,
    comment: '第三方车辆损坏'
  },
  propertyDamage: {
    type: DataTypes.TEXT,
    comment: '财产损失情况'
  },
  policeCalled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否报警'
  },
  policeReportNo: {
    type: DataTypes.STRING,
    comment: '报警编号'
  },
  insuranceCalled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否报保险'
  },
  insuranceReportNo: {
    type: DataTypes.STRING,
    comment: '保险报案号'
  },
  photos: {
    type: DataTypes.JSON,
    comment: '事故照片'
  },
  witnessName: {
    type: DataTypes.STRING,
    comment: '目击证人姓名'
  },
  witnessPhone: {
    type: DataTypes.STRING,
    comment: '目击证人电话'
  },
  witnessStatement: {
    type: DataTypes.TEXT,
    comment: '证人陈述'
  },
  estimatedLoss: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '预估损失金额'
  },
  liability: {
    type: DataTypes.ENUM('customer', 'company', 'third_party', 'undetermined'),
    defaultValue: 'undetermined',
    comment: '责任判定'
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending_review', 'pending_processing', 'rejected', 'approved', 'closed'),
    defaultValue: 'draft',
    comment: '记录状态'
  },
  reviewReason: {
    type: DataTypes.TEXT,
    comment: '审核原因'
  },
  reviewer: {
    type: DataTypes.STRING,
    comment: '审核人'
  },
  reviewTime: {
    type: DataTypes.DATE,
    comment: '审核时间'
  },
  previousVersionId: {
    type: DataTypes.UUID,
    comment: '上一版本ID，用于追踪修改历史'
  },
  versionNumber: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '版本号'
  },
  modificationCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '修改次数'
  }
}, {
  tableName: 'accident_records',
  timestamps: true,
  paranoid: true
});

module.exports = AccidentRecord;
