const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '商品名称'
  },
  sku: {
    type: DataTypes.STRING,
    unique: true,
    comment: '商品SKU'
  },
  category: {
    type: DataTypes.ENUM('frozen_meat', 'yogurt', 'fresh_fruit', 'other'),
    defaultValue: 'other',
    comment: '商品分类：冷冻肉、酸奶、鲜切水果、其他'
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: '件',
    comment: '单位：件、盒、袋等'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '单价'
  },
  storage_temp: {
    type: DataTypes.ENUM('frozen', 'refrigerated', 'normal'),
    defaultValue: 'refrigerated',
    comment: '存储温度要求：冷冻、冷藏、常温'
  },
  shelf_life_days: {
    type: DataTypes.INTEGER,
    comment: '保质期天数'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '商品描述'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  }
}, {
  tableName: 'products',
  comment: '商品表'
});

module.exports = Product;
