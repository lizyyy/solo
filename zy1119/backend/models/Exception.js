const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Exception = sequelize.define('Exception', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    comment: '关联订单ID'
  },
  type: {
    type: DataTypes.ENUM('shortage', 'expiry', 'quality', 'other'),
    defaultValue: 'other',
    comment: '异常类型：缺货、临期/过期、质量问题、其他'
  },
  product_id: {
    type: DataTypes.INTEGER,
    comment: '关联商品ID'
  },
  affected_quantity: {
    type: DataTypes.INTEGER,
    comment: '影响数量'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '异常描述'
  },
  action: {
    type: DataTypes.ENUM('pending', 'transfer', 'refund', 'exchange', 'resolved'),
    defaultValue: 'pending',
    comment: '处理方式：待处理、调拨、退款、换货、已解决'
  },
  action_detail: {
    type: DataTypes.TEXT,
    comment: '处理详情'
  },
  status: {
    type: DataTypes.ENUM('open', 'processing', 'resolved', 'closed'),
    defaultValue: 'open',
    comment: '状态：待处理、处理中、已解决、已关闭'
  },
  resolved_at: {
    type: DataTypes.DATE,
    comment: '解决时间'
  }
}, {
  tableName: 'exceptions',
  comment: '异常处理表'
});

module.exports = Exception;
