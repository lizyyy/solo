const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Shipment = require('./Shipment');

const TransportNode = sequelize.define('TransportNode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  shipmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Shipment,
      key: 'id'
    }
  },
  nodeType: {
    type: DataTypes.ENUM('warehouse', 'transit', 'distribution', 'delivery'),
    allowNull: false
  },
  nodeName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  arrivalTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  departureTime: {
    type: DataTypes.DATE
  },
  responsibleParty: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  operatorName: {
    type: DataTypes.STRING(50)
  },
  minTempAtNode: {
    type: DataTypes.DECIMAL(5, 2)
  },
  maxTempAtNode: {
    type: DataTypes.DECIMAL(5, 2)
  },
  remarks: {
    type: DataTypes.TEXT
  },
  nodeOrder: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'transport_nodes',
  timestamps: true
});

TransportNode.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });
Shipment.hasMany(TransportNode, { foreignKey: 'shipmentId', as: 'transportNodes' });

module.exports = TransportNode;
