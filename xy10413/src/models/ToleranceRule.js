const { DataTypes } = require('sequelize');
const sequelize = require('../db/database');

const ToleranceRule = sequelize.define('ToleranceRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  ruleName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'rule_name'
  },
  productCode: {
    type: DataTypes.STRING,
    field: 'product_code'
  },
  spec: {
    type: DataTypes.STRING
  },
  toleranceType: {
    type: DataTypes.ENUM('percentage', 'quantity'),
    allowNull: false,
    field: 'tolerance_type'
  },
  toleranceValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'tolerance_value'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_default'
  }
}, {
  tableName: 'tolerance_rules'
});

module.exports = ToleranceRule;
