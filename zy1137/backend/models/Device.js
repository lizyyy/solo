const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Device extends Model {
  static associate(models) {
    Device.hasMany(models.ScanRecord, {
      foreignKey: 'device_id',
      as: 'scanRecords'
    });
    Device.hasMany(models.PairingEvent, {
      foreignKey: 'device_id',
      as: 'pairingEvents'
    });
    Device.hasMany(models.Anomaly, {
      foreignKey: 'device_id',
      as: 'anomalies'
    });
    Device.belongsTo(models.Zone, {
      foreignKey: 'zone_id',
      as: 'zone'
    });
    Device.hasMany(models.HandlingRecord, {
      foreignKey: 'device_id',
      as: 'handlingRecords'
    });
  }
}

Device.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  mac_address: {
    type: DataTypes.STRING(17),
    allowNull: false,
    unique: true
  },
  device_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  device_type: {
    type: DataTypes.ENUM('esl', 'printer', 'beacon', 'scanner', 'headset', 'other'),
    allowNull: false,
    defaultValue: 'other'
  },
  serial_number: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  model: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  manufacturer: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  battery_level: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 100
    }
  },
  last_seen: {
    type: DataTypes.DATE,
    allowNull: true
  },
  first_seen: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_random_address: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  canonical_device_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'devices',
      key: 'id'
    }
  },
  zone_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'zones',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'maintenance', 'missing'),
    defaultValue: 'active'
  },
  risk_tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  sequelize,
  modelName: 'Device',
  tableName: 'devices',
  indexes: [
    { fields: ['mac_address'], unique: true },
    { fields: ['device_type'] },
    { fields: ['status'] },
    { fields: ['zone_id'] },
    { fields: ['last_seen'] },
    { fields: ['canonical_device_id'] }
  ]
});

module.exports = Device;
