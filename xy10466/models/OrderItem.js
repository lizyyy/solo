const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'Orders',
      key: 'id'
    }
  },
  dishId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dishName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  isMissing: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

module.exports = OrderItem;
