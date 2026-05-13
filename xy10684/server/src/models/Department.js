const { sequelize, DataTypes } = require('../database');

const Department = sequelize.define('Department', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '部门编码'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '部门名称'
  },
  manager: {
    type: DataTypes.STRING,
    comment: '负责人'
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  }
}, {
  tableName: 'department',
  timestamps: true
});

module.exports = Department;
