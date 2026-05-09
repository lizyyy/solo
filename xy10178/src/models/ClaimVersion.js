const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ClaimVersion extends Model {}

ClaimVersion.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  claimId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'claims',
      key: 'id'
    }
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '版本号'
  },
  merchantRatio: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: false,
    defaultValue: 0,
    comment: '商家责任比例'
  },
  warehouseRatio: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: false,
    defaultValue: 0,
    comment: '仓库责任比例'
  },
  deliveryRatio: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: false,
    defaultValue: 0,
    comment: '配送方责任比例'
  },
  merchantAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '商家分摊金额'
  },
  warehouseAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '仓库分摊金额'
  },
  deliveryAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '配送方分摊金额'
  },
  status: {
    type: DataTypes.ENUM,
    values: ['PENDING', 'REVIEWING', 'ALLOCATED', 'CONFIRMED', 'PAID', 'CANCELLED'],
    defaultValue: 'PENDING',
    comment: '该版本的状态'
  },
  createdBy: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '创建人'
  }
}, {
  sequelize,
  modelName: 'ClaimVersion',
  tableName: 'claim_versions',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['claimId', 'version']
    }
  ]
});

module.exports = ClaimVersion;
