const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');
const User = require('./User');

const DataRecord = sequelize.define('DataRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected'),
    defaultValue: 'draft'
  },
  idempotencyKey: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  }
}, {
  version: 'version',
  indexes: [
    {
      fields: ['tenantId', 'status']
    },
    {
      fields: ['tenantId', 'createdBy', 'idempotencyKey'],
      unique: true
    }
  ]
});

DataRecord.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
DataRecord.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
DataRecord.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });

module.exports = DataRecord;
