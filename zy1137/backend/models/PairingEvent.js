const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class PairingEvent extends Model {
  static associate(models) {
    PairingEvent.belongsTo(models.Device, {
      foreignKey: 'device_id',
      as: 'device'
    });
    PairingEvent.belongsTo(models.Zone, {
      foreignKey: 'zone_id',
      as: 'zone'
    });
  }
}

PairingEvent.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'devices',
      key: 'id'
    }
  },
  mac_address: {
    type: DataTypes.STRING(17),
    allowNull: false
  },
  event_type: {
    type: DataTypes.ENUM('pair', 'connect', 'disconnect', 'unpair', 'fail'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('success', 'failed', 'timeout'),
    allowNull: false
  },
  host_device: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '连接的主机设备，如手机型号、POS机ID等'
  },
  host_mac: {
    type: DataTypes.STRING(17),
    allowNull: true
  },
  event_timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  zone_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'zones',
      key: 'id'
    }
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '连接持续时间，单位秒'
  },
  error_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '失败时的错误码'
  },
  error_message: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '失败时的错误信息'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '操作人'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  sequelize,
  modelName: 'PairingEvent',
  tableName: 'pairing_events',
  indexes: [
    { fields: ['mac_address'] },
    { fields: ['device_id'] },
    { fields: ['event_type'] },
    { fields: ['status'] },
    { fields: ['event_timestamp'] },
    { fields: ['host_device'] },
    { fields: ['zone_id'] }
  ]
});

module.exports = PairingEvent;
