const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const House = require('./House');

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  houseId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: House,
      key: 'id'
    }
  },
  roomNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  hasWaterMeter: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  hasElectricityMeter: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

House.hasMany(Room, { foreignKey: 'houseId' });
Room.belongsTo(House, { foreignKey: 'houseId' });

module.exports = Room;
