const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OutboundRecord = sequelize.define('OutboundRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  outbound_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '出库单号'
  },
  requisition_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '申领单ID'
  },
  requisition_item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '申领单项ID'
  },
  inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '库存ID'
  },
  batch_no: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '批次号'
  },
  reagent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '试剂ID'
  },
  reagent_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '试剂名称'
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '出库数量'
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '单位'
  },
  receiver_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '领取人ID'
  },
  receiver_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '领取人姓名'
  },
  handler_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '出库操作人ID'
  },
  handler_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '出库操作人姓名'
  },
  outbound_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '出库时间'
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '存放位置'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'outbound_records',
  comment: '出库记录表'
});

module.exports = OutboundRecord;
