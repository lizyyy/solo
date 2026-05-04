const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class ScanRecord extends Model {
  static associate(models) {
    ScanRecord.belongsTo(models.Device, {
      foreignKey: 'device_id',
      as: 'device'
    });
    ScanRecord.belongsTo(models.Zone, {
      foreignKey: 'zone_id',
      as: 'zone'
    });
  }
}

ScanRecord.init({
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
  rssi: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  tx_power: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  scan_timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  scan_source: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '扫描来源：gateway, phone, scanner等'
  },
  zone_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'zones',
      key: 'id'
    }
  },
  advertising_data: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '广播数据，包括设备名称、服务UUID、厂商数据等'
  },
  is_connectable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  raw_data: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '原始扫描数据'
  }
}, {
  sequelize,
  modelName: 'ScanRecord',
  tableName: 'scan_records',
  indexes: [
    { fields: ['mac_address'] },
    { fields: ['device_id'] },
    { fields: ['scan_timestamp'] },
    { fields: ['rssi'] },
    { fields: ['zone_id'] },
    { fields: ['mac_address', 'scan_timestamp'] }
  ]
});

module.exports = ScanRecord;
