const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class HandlingRecord extends Model {
  static associate(models) {
    HandlingRecord.belongsTo(models.Device, {
      foreignKey: 'device_id',
      as: 'device'
    });
    HandlingRecord.belongsTo(models.Anomaly, {
      foreignKey: 'anomaly_id',
      as: 'anomaly'
    });
  }
}

HandlingRecord.init({
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
  anomaly_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'anomalies',
      key: 'id'
    }
  },
  action_type: {
    type: DataTypes.ENUM(
      'acknowledge',
      'investigate',
      'assign',
      'visit_site',
      'replace_battery',
      're_pair',
      'replace_device',
      'update_config',
      'mark_false_positive',
      'resolve',
      'comment',
      'other'
    ),
    allowNull: false
  },
  action_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  handler: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  result: {
    type: DataTypes.ENUM('success', 'failed', 'pending', 'partial'),
    allowNull: true
  },
  previous_status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  new_status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  attachments: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: '附件信息，如图片路径、文件链接等'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  sequelize,
  modelName: 'HandlingRecord',
  tableName: 'handling_records',
  indexes: [
    { fields: ['device_id'] },
    { fields: ['anomaly_id'] },
    { fields: ['action_type'] },
    { fields: ['action_time'] },
    { fields: ['handler'] },
    { fields: ['result'] }
  ]
});

module.exports = HandlingRecord;
