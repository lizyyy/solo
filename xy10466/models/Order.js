const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  customerId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  orderTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'preparing', 'delivering', 'completed', 'cancelled'),
    defaultValue: 'pending'
  },
  restaurantOutTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expectedDeliveryTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  actualDeliveryTime: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Order;
