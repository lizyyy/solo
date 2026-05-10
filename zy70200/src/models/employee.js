const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Employee = sequelize.define('Employee', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  employeeNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false
  },
  position: {
    type: DataTypes.STRING,
    allowNull: false
  },
  hireDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  baseSalary: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  currentSalary: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'employees',
  timestamps: true,
  paranoid: true
});

module.exports = Employee;
