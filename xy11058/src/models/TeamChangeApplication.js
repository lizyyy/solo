const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TeamChangeApplication = sequelize.define('TeamChangeApplication', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  applicationNo: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
    comment: '改队申请单号'
  },
  studyProgramId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '研学项目ID'
  },
  studyProgramName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '研学项目名称'
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '学生ID'
  },
  studentName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '学生姓名'
  },
  studentIdCard: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '学生身份证号'
  },
  parentContact: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '家长联系电话'
  },
  originalTeamId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '原分队ID'
  },
  originalTeamName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '原分队名称'
  },
  originalTeamLeader: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '原带队老师'
  },
  targetTeamId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '目标分队ID'
  },
  targetTeamName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '目标分队名称'
  },
  targetTeamLeader: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '目标带队老师'
  },
  changeReason: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '改队原因'
  },
  changeReasonType: {
    type: DataTypes.ENUM('身体原因', '家庭原因', '个人意愿', '其他'),
    allowNull: false,
    comment: '改队原因类型'
  },
  status: {
    type: DataTypes.ENUM('草稿', '待审核', '审核中', '人工处理中', '已通过', '已拒绝', '已撤回', '已取消'),
    defaultValue: '草稿',
    allowNull: false,
    comment: '申请状态'
  },
  currentHandlerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '当前处理人ID'
  },
  currentHandlerName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '当前处理人姓名'
  },
  applicantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '申请人ID'
  },
  applicantName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '申请人姓名'
  },
  submitTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '提交时间'
  },
  approveTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '审核通过时间'
  },
  insuranceSynced: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '保险名单是否已同步'
  },
  teamConsistent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '分队表是否一致'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'team_change_applications',
  timestamps: true,
  paranoid: true
});

module.exports = TeamChangeApplication;
