const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Batch = require('./batch');
const Store = require('./store');

class Waybill extends Model {}

Waybill.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  waybillNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'waybill_number',
    comment: '联单编号'
  },
  collectionTime: {
    type: DataTypes.DATE,
    field: 'collection_time',
    comment: '回收时间'
  },
  weight: {
    type: DataTypes.FLOAT,
    comment: '重量(千克)'
  },
  oilType: {
    type: DataTypes.STRING,
    field: 'oil_type',
    comment: '油类类型'
  },
  storeSignature: {
    type: DataTypes.STRING,
    field: 'store_signature',
    comment: '门店签字'
  },
  driverSignature: {
    type: DataTypes.STRING,
    field: 'driver_signature',
    comment: '司机签字'
  },
  rawData: {
    type: DataTypes.TEXT,
    field: 'raw_data',
    comment: '原始JSON数据'
  },
  status: {
    type: DataTypes.ENUM('pending', 'verified', 'flagged', 'rejected'),
    defaultValue: 'pending',
    comment: '状态: pending-待审核, verified-已验证, flagged-有异常, rejected-已驳回'
  }
}, {
  sequelize,
  modelName: 'Waybill',
  tableName: 'waybills',
  comment: '联单表'
});

Waybill.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });
Batch.hasMany(Waybill, { foreignKey: 'batchId', as: 'waybills' });

Waybill.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });
Store.hasMany(Waybill, { foreignKey: 'storeId', as: 'waybills' });

module.exports = Waybill;
