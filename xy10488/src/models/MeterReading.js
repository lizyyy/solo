const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const House = require('./House');
const Room = require('./Room');

const MeterReading = sequelize.define('MeterReading', {
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
  roomId: {
    type: DataTypes.UUID,
    references: {
      model: Room,
      key: 'id'
    }
  },
  readingType: {
    type: DataTypes.ENUM('water', 'electricity'),
    allowNull: false
  },
  readingDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  readingValue: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isAbnormal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  abnormalityReason: {
    type: DataTypes.STRING
  }
});

House.hasMany(MeterReading, { foreignKey: 'houseId' });
MeterReading.belongsTo(House, { foreignKey: 'houseId' });
Room.hasMany(MeterReading, { foreignKey: 'roomId' });
MeterReading.belongsTo(Room, { foreignKey: 'roomId' });

module.exports = MeterReading;
