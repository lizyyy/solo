const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RoadSection = sequelize.define('RoadSection', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  roadName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sectionName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  startMileage: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  endMileage: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  totalLength: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  availableLength: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  lanes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2
  },
  roadClass: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'AVAILABLE'
  },
  description: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'road_sections',
  timestamps: true,
  paranoid: true
});

module.exports = RoadSection;
