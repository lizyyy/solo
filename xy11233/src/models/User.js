const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
  LAB_MANAGER: 'lab_manager'
};

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  employee_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '工号/学号'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '姓名'
  },
  role: {
    type: DataTypes.ENUM(Object.values(ROLES)),
    allowNull: false,
    comment: '角色'
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '部门/院系'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '联系电话（敏感字段）'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '邮箱（敏感字段）'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否激活'
  }
}, {
  tableName: 'users',
  comment: '用户表'
});

User.ROLES = ROLES;

module.exports = User;
