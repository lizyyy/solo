const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SampleRecord = sequelize.define('SampleRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sampleCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  samplingPointId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  bottleId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  preservative: {
    type: DataTypes.STRING(100),
    comment: '实际使用的保存剂'
  },
  samplingTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  sampler: {
    type: DataTypes.STRING(50),
    comment: '采样人'
  },
  status: {
    type: DataTypes.ENUM('sampled', 'transported', 'received', 'testing', 'completed', 'rejected'),
    defaultValue: 'sampled'
  },
  temperature: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '采样温度'
  },
  weather: {
    type: DataTypes.STRING(50),
    comment: '天气情况'
  },
  remarks: {
    type: DataTypes.TEXT
  }
}, {
  timestamps: true
});

module.exports = SampleRecord;
