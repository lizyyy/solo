const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TestItem = sequelize.define('TestItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sampleRecordId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  itemName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  itemCode: {
    type: DataTypes.STRING(50)
  },
  expectedValue: {
    type: DataTypes.STRING(100),
    comment: '标准值/参考值'
  },
  actualValue: {
    type: DataTypes.STRING(100),
    comment: '检测结果'
  },
  unit: {
    type: DataTypes.STRING(20)
  },
  tester: {
    type: DataTypes.STRING(50),
    comment: '检测人'
  },
  testTime: {
    type: DataTypes.DATE
  },
  isAbnormal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  remarks: {
    type: DataTypes.TEXT
  }
}, {
  timestamps: true
});

module.exports = TestItem;
