const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { SalaryAdjustmentStatus } = require('../constants');

const SalaryAdjustment = sequelize.define('SalaryAdjustment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  probationPlanId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  previousSalary: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  newSalary: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  adjustmentAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  adjustmentPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: false
  },
  effectiveDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(...Object.values(SalaryAdjustmentStatus)),
    defaultValue: SalaryAdjustmentStatus.PENDING
  },
  approvedBy: {
    type: DataTypes.UUID
  },
  approvedAt: {
    type: DataTypes.DATE
  },
  effectiveAt: {
    type: DataTypes.DATE
  },
  taskId: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'salary_adjustments',
  timestamps: true,
  paranoid: true
});

module.exports = SalaryAdjustment;
