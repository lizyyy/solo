const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Role = require('./Role');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '用户名'
  },
  realName: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '真实姓名'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '联系电话'
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Role,
      key: 'id'
    },
    comment: '角色ID'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
    comment: '用户状态'
  }
}, {
  tableName: 'users',
  timestamps: true,
  paranoid: true
});

User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
Role.hasMany(User, { foreignKey: 'roleId' });

module.exports = User;
