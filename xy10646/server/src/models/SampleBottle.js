const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SampleBottle = sequelize.define('SampleBottle', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bottleNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  preservative: {
    type: DataTypes.STRING(100),
    comment: '保存剂类型'
  },
  volume: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '容量(ml)'
  },
  material: {
    type: DataTypes.STRING(50),
    comment: '材质: 玻璃/塑料'
  },
  status: {
    type: DataTypes.ENUM('available', 'in_use', 'cleaning', 'damaged'),
    defaultValue: 'available'
  }
}, {
  timestamps: true
});

module.exports = SampleBottle;
