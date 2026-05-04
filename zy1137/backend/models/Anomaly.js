const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Anomaly extends Model {
  static associate(models) {
    Anomaly.belongsTo(models.Device, {
      foreignKey: 'device_id',
      as: 'device'
    });
    Anomaly.belongsTo(models.Zone, {
      foreignKey: 'zone_id',
      as: 'zone'
    });
    Anomaly.hasMany(models.HandlingRecord, {
      foreignKey: 'anomaly_id',
      as: 'handlingRecords'
    });
  }
}

Anomaly.init({
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
    allowNull: true
  },
  anomaly_type: {
    type: DataTypes.ENUM(
      'rssi_fluctuation',
      'long_disconnect',
      'duplicate_device',
      'random_address_drift',
      'low_battery',
      'pairing_failures',
      'zone_violation',
      'scan_failure',
      'connection_drop',
      'unknown'
    ),
    allowNull: false,
    defaultValue: 'unknown'
  },
  severity: {
    type: DataTypes.ENUM('critical', 'high', 'medium', 'low', 'info'),
    allowNull: false,
    defaultValue: 'medium'
  },
  status: {
    type: DataTypes.ENUM('open', 'acknowledged', 'investigating', 'resolved', 'false_positive'),
    allowNull: false,
    defaultValue: 'open'
  },
  detected_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  first_detected_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_updated_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  zone_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'zones',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  evidence: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '异常证据数据，如RSSI值列表、配对失败记录等'
  },
  related_scan_ids: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: '相关的扫描记录ID'
  },
  related_pairing_ids: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: '相关的配对事件ID'
  },
  risk_score: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
    validate: {
      min: 0,
      max: 100
    }
  },
  threshold_config: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '检测时使用的阈值配置'
  },
  assigned_to: {
    type: DataTypes.STRING(50),
    allowNull: true
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
  modelName: 'Anomaly',
  tableName: 'anomalies',
  indexes: [
    { fields: ['device_id'] },
    { fields: ['mac_address'] },
    { fields: ['anomaly_type'] },
    { fields: ['severity'] },
    { fields: ['status'] },
    { fields: ['detected_at'] },
    { fields: ['risk_score'] },
    { fields: ['assigned_to'] }
  ]
});

module.exports = Anomaly;
