const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const BillRecord = sequelize.define('BillRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  billImportId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'BillImports',
      key: 'id',
    },
  },
  billMonth: {
    type: DataTypes.STRING(7),
    allowNull: false,
  },
  resourceId: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  resourceName: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  resourceType: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  productCode: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  productName: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  region: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  usageAmount: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: true,
  },
  usageUnit: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  costAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  tags: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Projects',
      key: 'id',
    },
  },
  allocationMethod: {
    type: DataTypes.ENUM('auto_tag', 'manual', 'shared_service', 'unallocated'),
    allowNull: false,
    defaultValue: 'unallocated',
  },
  sharedServiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'SharedServices',
      key: 'id',
    },
  },
  environment: {
    type: DataTypes.ENUM('production', 'test', 'staging', 'development', 'other'),
    allowNull: true,
  },
});

module.exports = BillRecord;
