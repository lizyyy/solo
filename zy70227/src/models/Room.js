const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'rooms',
  timestamps: true
});

module.exports = Room;
