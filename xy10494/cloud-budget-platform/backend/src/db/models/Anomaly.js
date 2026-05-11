const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const Anomaly = sequelize.define('Anomaly', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  anomalyType: {
    type: DataTypes.ENUM(
      'no_tags',
      'tag_conflict',
      'allocation_over_total',
      'duplicate_import',
      'allocation_ratio_invalid'
    ),
    allowNull: false,
  },
  billImportId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'BillImports',
      key: 'id',
    },
  },
  billRecordId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'BillRecords',
      key: 'id',
    },
  },
  sharedServiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'SharedServices',
      key: 'id',
    },
  },
  billMonth: {
    type: DataTypes.STRING(7),
    allowNull: false,
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false,
    defaultValue: 'medium',
  },
  status: {
    type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'ignored'),
    allowNull: false,
    defaultValue: 'open',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  resolvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolutionNote: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = Anomaly;
