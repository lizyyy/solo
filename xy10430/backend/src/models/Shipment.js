const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const CargoType = require('./CargoType');

const Shipment = sequelize.define('Shipment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  shipmentNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  cargoTypeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: CargoType,
      key: 'id'
    }
  },
  customerName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  origin: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  destination: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  cargoValue: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('in_transit', 'delivered', 'signed_off', 'claim_pending'),
    allowNull: false,
    defaultValue: 'in_transit'
  },
  departureTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  estimatedArrivalTime: {
    type: DataTypes.DATE
  },
  actualArrivalTime: {
    type: DataTypes.DATE
  },
  remarks: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'shipments',
  timestamps: true
});

Shipment.belongsTo(CargoType, { foreignKey: 'cargoTypeId', as: 'cargoType' });

module.exports = Shipment;
