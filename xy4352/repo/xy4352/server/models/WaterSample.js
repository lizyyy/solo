const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class WaterSample extends Model {}

WaterSample.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  samplePoint: {
    type: DataTypes.STRING,
    field: 'sample_point',
    allowNull: false,
    comment: '采样点名称'
  },
  sampleTime: {
    type: DataTypes.DATE,
    field: 'sample_time',
    allowNull: false,
    comment: '采样时间'
  },
  chlorine: {
    type: DataTypes.FLOAT,
    allowNull: false,
    comment: '余氯 (mg/L)'
  },
  ph: {
    type: DataTypes.FLOAT,
    allowNull: false,
    comment: 'pH值'
  },
  turbidity: {
    type: DataTypes.FLOAT,
    allowNull: false,
    comment: '浊度 (NTU)'
  },
  temperature: {
    type: DataTypes.FLOAT,
    field: 'temperature',
    allowNull: false,
    comment: '水温 (°C)'
  },
  operator: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '当班人员'
  },
  sourceFile: {
    type: DataTypes.STRING,
    field: 'source_file',
    allowNull: true,
    comment: '来源文件名'
  },
  importTime: {
    type: DataTypes.DATE,
    field: 'import_time',
    defaultValue: DataTypes.NOW,
    comment: '导入时间'
  }
}, {
  sequelize,
  modelName: 'WaterSample',
  tableName: 'water_samples',
  indexes: [
    {
      name: 'idx_water_samples_sample_point',
      fields: ['sample_point']
    },
    {
      name: 'idx_water_samples_sample_time',
      fields: ['sample_time']
    },
    {
      name: 'idx_water_samples_sample_point_time',
      fields: ['sample_point', 'sample_time']
    }
  ]
});

module.exports = WaterSample;
