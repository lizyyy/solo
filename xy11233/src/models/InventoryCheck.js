const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CHECK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const InventoryCheck = sequelize.define('InventoryCheck', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  check_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '盘点单号'
  },
  check_type: {
    type: DataTypes.ENUM('full', 'partial', 'hazardous'),
    allowNull: false,
    defaultValue: 'partial',
    comment: '盘点类型'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '盘点标题'
  },
  checker_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '盘点人ID'
  },
  checker_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '盘点人姓名'
  },
  supervisor_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '监盘人ID'
  },
  supervisor_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '监盘人姓名'
  },
  status: {
    type: DataTypes.ENUM(Object.values(CHECK_STATUSES)),
    allowNull: false,
    defaultValue: CHECK_STATUSES.PENDING,
    comment: '盘点状态'
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '开始时间'
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '结束时间'
  },
  total_items: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '盘点项总数'
  },
  matched_items: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '账实相符项数'
  },
  mismatched_items: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '账实不符项数'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'inventory_checks',
  comment: '盘点单表'
});

InventoryCheck.CHECK_STATUSES = CHECK_STATUSES;

module.exports = InventoryCheck;
