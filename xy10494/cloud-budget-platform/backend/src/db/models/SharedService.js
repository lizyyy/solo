const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const SharedService = sequelize.define('SharedService', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tagKey: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  tagValue: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = SharedService;
