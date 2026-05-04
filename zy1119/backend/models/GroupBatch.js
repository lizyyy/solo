const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GroupBatch = sequelize.define('GroupBatch', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  batch_no: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    comment: '团购批次号'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '团购名称'
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '接龙开始时间'
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '接龙结束时间'
  },
  delivery_date: {
    type: DataTypes.DATEONLY,
    comment: '预计到货日期'
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'closed', 'delivered', 'completed'),
    defaultValue: 'draft',
    comment: '状态：草稿、进行中、已结束、已到货、已完成'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '团购描述'
  }
}, {
  tableName: 'group_batches',
  comment: '团购批次表'
});

module.exports = GroupBatch;
