const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LabRecord = sequelize.define('lab_record', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  printBatchId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '印刷批次ID'
  },
  printBatchNo: {
    type: DataTypes.STRING(50),
    comment: '印刷批次号'
  },
  samplePoint: {
    type: DataTypes.STRING(50),
    comment: '采样点'
  },
  measureL: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    comment: '实测L值'
  },
  measureA: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    comment: '实测A值'
  },
  measureB: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    comment: '实测B值'
  },
  deltaL: {
    type: DataTypes.DECIMAL(5, 2),
    comment: 'L差值'
  },
  deltaA: {
    type: DataTypes.DECIMAL(5, 2),
    comment: 'A差值'
  },
  deltaB: {
    type: DataTypes.DECIMAL(5, 2),
    comment: 'B差值'
  },
  deltaE: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '总色差'
  },
  isPassed: {
    type: DataTypes.BOOLEAN,
    comment: '是否合格'
  },
  measureTime: {
    type: DataTypes.DATE,
    comment: '测量时间'
  },
  measuredBy: {
    type: DataTypes.STRING(50),
    comment: '测量人'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  indexes: [
    { fields: ['printBatchId'] },
    { fields: ['printBatchNo'] },
    { fields: ['measureTime'] },
    { fields: ['isPassed'] }
  ]
});

module.exports = LabRecord;
