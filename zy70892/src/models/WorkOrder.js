const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkOrder = sequelize.define('WorkOrder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '工单号'
  },
  productCode: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '产品编码'
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '产品名称'
  },
  plannedQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '计划数量'
  },
  actualQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '实际数量'
  },
  workstation: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '生产工位'
  },
  shift: {
    type: DataTypes.STRING,
    comment: '班次'
  },
  operator: {
    type: DataTypes.STRING,
    comment: '操作员'
  },
  startTime: {
    type: DataTypes.DATE,
    comment: '开始时间'
  },
  endTime: {
    type: DataTypes.DATE,
    comment: '结束时间'
  },
  status: {
    type: DataTypes.ENUM('created', 'in_progress', 'completed', 'closed'),
    defaultValue: 'created',
    comment: '工单状态'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'work_orders',
  timestamps: true
});

module.exports = WorkOrder;
