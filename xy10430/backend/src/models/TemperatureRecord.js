const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Shipment = require('./Shipment');

const TemperatureRecord = sequelize.define('TemperatureRecord', {
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
  recordTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  temperature: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  humidity: {
    type: DataTypes.DECIMAL(5, 2)
  },
  location: {
    type: DataTypes.STRING(100)
  },
  isOvertemp: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  source: {
    type: DataTypes.ENUM('device', 'manual', 'import'),
    defaultValue: 'device'
  }
}, {
  tableName: 'temperature_records',
  timestamps: true,
  indexes: [
    {
      fields: ['shipmentId', 'recordTime']
    }
  ]
});

TemperatureRecord.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });
Shipment.hasMany(TemperatureRecord, { foreignKey: 'shipmentId', as: 'temperatureRecords' });

module.exports = TemperatureRecord;
