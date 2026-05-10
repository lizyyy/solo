const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RegionRuleType = {
  INCLUDE: 'include',
  EXCLUDE: 'exclude'
};

const RegionRule = sequelize.define('RegionRule', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false
  },
  authorizationId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'authorization_id'
  },
  ruleType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'rule_type'
  },
  regionCode: {
    type: DataTypes.STRING(10),
    allowNull: false,
    field: 'region_code'
  },
  regionName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'region_name'
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at'
  }
}, {
  tableName: 'region_rules',
  timestamps: true,
  underscored: true
});

module.exports = { RegionRule, RegionRuleType };
