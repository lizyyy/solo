const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Batch = require('./batch');
const Store = require('./store');

class WeighingRecord extends Model {}

WeighingRecord.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  weighingNumber: {
    type: DataTypes.STRING,
    field: 'weighing_number',
    comment: '称重票编号'
  },
  storeName: {
    type: DataTypes.STRING,
    field: 'store_name',
    comment: '门店名称'
  },
  weight: {
    type: DataTypes.FLOAT,
    comment: '重量(千克)'
  },
  weighingTime: {
    type: DataTypes.DATE,
    field: 'weighing_time',
    comment: '称重时间'
  },
  operator: {
    type: DataTypes.STRING,
    comment: '操作员'
  },
  rawLine: {
    type: DataTypes.TEXT,
    field: 'raw_line',
    comment: 'CSV原始行数据'
  },
  lineNumber: {
    type: DataTypes.INTEGER,
    field: 'line_number',
    comment: 'CSV行号'
  },
  isDuplicate: {
    type: DataTypes.BOOLEAN,
    field: 'is_duplicate',
    defaultValue: false,
    comment: '是否重复称重'
  },
  duplicateWith: {
    type: DataTypes.UUID,
    field: 'duplicate_with',
    comment: '重复记录ID'
  },
  status: {
    type: DataTypes.ENUM('pending', 'verified', 'flagged', 'duplicate'),
    defaultValue: 'pending',
    comment: '状态: pending-待审核, verified-已验证, flagged-有异常, duplicate-重复'
  }
}, {
  sequelize,
  modelName: 'WeighingRecord',
  tableName: 'weighing_records',
  comment: '称重记录表'
});

WeighingRecord.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });
Batch.hasMany(WeighingRecord, { foreignKey: 'batchId', as: 'weighingRecords' });

WeighingRecord.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });
Store.hasMany(WeighingRecord, { foreignKey: 'storeId', as: 'weighingRecords' });

module.exports = WeighingRecord;
