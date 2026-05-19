const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '角色名称：admin, operator, viewer'
  },
  description: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '角色描述'
  },
  permissions: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '权限列表，JSON格式',
    get() {
      const rawValue = this.getDataValue('permissions');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('permissions', JSON.stringify(value));
    }
  }
}, {
  tableName: 'roles',
  timestamps: true,
  paranoid: true
});

module.exports = Role;
