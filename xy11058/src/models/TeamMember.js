const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TeamMember = sequelize.define('TeamMember', {
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
  teamName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '分队名称'
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
  role: {
    type: DataTypes.ENUM('队长', '副队长', '队员'),
    defaultValue: '队员',
    comment: '队内角色'
  },
  joinTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '入队时间'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否在队'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'team_members',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['studyProgramId', 'teamId', 'studentId']
    }
  ]
});

module.exports = TeamMember;
