const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Zone extends Model {
  static associate(models) {
    Zone.hasMany(models.Device, {
      foreignKey: 'zone_id',
      as: 'devices'
    });
    Zone.hasMany(models.ScanRecord, {
      foreignKey: 'zone_id',
      as: 'scanRecords'
    });
    Zone.hasMany(models.PairingEvent, {
      foreignKey: 'zone_id',
      as: 'pairingEvents'
    });
  }
}

Zone.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  zone_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  zone_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  zone_type: {
    type: DataTypes.ENUM('warehouse', 'retail', 'office', 'storage', 'entrance', 'checkout', 'other'),
    allowNull: false,
    defaultValue: 'other'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  location: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '位置信息，如楼层、区域坐标等'
  },
  expected_device_types: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: '该区域期望出现的设备类型'
  },
  allowed_device_types: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: '允许出现在该区域的设备类型'
  },
  forbidden_device_types: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: '禁止出现在该区域的设备类型'
  },
  rssi_threshold: {
    type: DataTypes.INTEGER,
    defaultValue: -70,
    comment: '该区域正常RSSI阈值，低于此值视为信号弱'
  },
  expected_scan_frequency_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    comment: '期望的扫描频率，单位分钟'
  },
  max_allowed_disconnect_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 120,
    comment: '最大允许失联时间，单位分钟'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  sequelize,
  modelName: 'Zone',
  tableName: 'zones',
  indexes: [
    { fields: ['zone_code'], unique: true },
    { fields: ['zone_type'] },
    { fields: ['status'] }
  ]
});

module.exports = Zone;
