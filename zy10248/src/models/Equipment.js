const { sequelize, DataTypes } = require('../config/database');

const Equipment = sequelize.define('Equipment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('projector', 'whiteboard', 'camera', 'microphone', 'speaker', 'tv', 'other'),
    allowNull: false
  },
  brand: {
    type: DataTypes.STRING
  },
  model: {
    type: DataTypes.STRING
  },
  serialNumber: {
    type: DataTypes.STRING,
    unique: true
  },
  meetingRoomId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('normal', 'damaged', 'repairing', 'scrapped'),
    defaultValue: 'normal'
  },
  purchaseDate: {
    type: DataTypes.DATE
  },
  price: {
    type: DataTypes.DECIMAL(10, 2)
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

module.exports = Equipment;
