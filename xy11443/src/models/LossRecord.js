const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LossRecord = sequelize.define('LossRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '批次ID'
  },
  lossNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '损耗记录号'
  },
  lossType: {
    type: DataTypes.ENUM('bad_fruit', 'secondary_sorting', 'damage', 'other', 'manual'),
    allowNull: false,
    comment: '损耗类型：坏果扣款、二次分拣损耗、损坏、其他、人工改判'
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '商品名称'
  },
  lossWeight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '损耗重量'
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'kg',
    comment: '单位'
  },
  lossRate: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '损耗率(%)'
  },
  deductionAmount: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '扣款金额'
  },
  reason: {
    type: DataTypes.TEXT,
    comment: '损耗原因'
  },
  isDeducted: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否扣款'
  },
  isManualAdjusted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否人工改判'
  },
  manualAdjustReason: {
    type: DataTypes.TEXT,
    comment: '人工改判原因'
  },
  relatedPhotoIds: {
    type: DataTypes.TEXT,
    comment: '关联照片ID列表(JSON)'
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'adjusted', 'withdrawn', 'replaced'),
    defaultValue: 'pending',
    comment: '状态'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '版本号'
  },
  previousId: {
    type: DataTypes.UUID,
    comment: '上一版本ID'
  },
  confirmedBy: {
    type: DataTypes.STRING,
    comment: '确认人'
  },
  confirmedAt: {
    type: DataTypes.DATE,
    comment: '确认时间'
  },
  adjustedBy: {
    type: DataTypes.STRING,
    comment: '改判人'
  },
  adjustedAt: {
    type: DataTypes.DATE,
    comment: '改判时间'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '创建人'
  }
}, {
  tableName: 'loss_records',
  indexes: [
    { fields: ['batch_id'] },
    { fields: ['loss_no'], unique: true },
    { fields: ['loss_type'] },
    { fields: ['status'] },
    { fields: ['is_manual_adjusted'] }
  ]
});

module.exports = LossRecord;
