const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MaterialOrder = sequelize.define('MaterialOrder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  projectName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  materialName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  materialType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  specification: {
    type: DataTypes.STRING
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false
  },
  unitPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  totalAmount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false
  },
  supplier: {
    type: DataTypes.STRING,
    allowNull: false
  },
  expectedDeliveryDate: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.ENUM('pending', 'partial_delivered', 'delivered', 'inspected', 'returned', 'completed'),
    defaultValue: 'pending'
  },
  responsiblePerson: {
    type: DataTypes.STRING,
    allowNull: false
  },
  remarks: {
    type: DataTypes.TEXT
  },
  createdBy: {
    type: DataTypes.STRING
  },
  updatedBy: {
    type: DataTypes.STRING
  }
}, {
  timestamps: true,
  tableName: 'material_orders'
});

module.exports = MaterialOrder;
