const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InsuranceList = sequelize.define('InsuranceList', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  studyProgramId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '研学项目ID'
  },
  teamId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '分队ID'
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
  insurancePolicyNo: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '保单号'
  },
  insuranceType: {
    type: DataTypes.ENUM('意外险', '医疗险', '综合险'),
    allowNull: false,
    comment: '保险类型'
  },
  effectiveDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '生效日期'
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '失效日期'
  },
  status: {
    type: DataTypes.ENUM('有效', '已退保', '已变更'),
    defaultValue: '有效',
    comment: '保险状态'
  },
  lastSyncTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后同步时间'
  }
}, {
  tableName: 'insurance_list',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['studyProgramId', 'teamId', 'studentId']
    }
  ]
});

module.exports = InsuranceList;
