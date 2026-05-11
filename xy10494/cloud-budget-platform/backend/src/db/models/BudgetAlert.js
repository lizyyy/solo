const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const BudgetAlert = sequelize.define('BudgetAlert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Projects',
      key: 'id',
    },
  },
  alertType: {
    type: DataTypes.ENUM('threshold_70', 'threshold_90', 'exceeded', 'forecast_exceed'),
    allowNull: false,
  },
  alertMonth: {
    type: DataTypes.STRING(7),
    allowNull: false,
  },
  budgetAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  actualAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  forecastAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },
  isAcknowledged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  acknowledgedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = BudgetAlert;
