const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Freezer = sequelize.define('Freezer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '冰柜名称'
  },
  code: {
    type: DataTypes.STRING,
    unique: true,
    comment: '冰柜编号'
  },
  type: {
    type: DataTypes.ENUM('frozen', 'refrigerated'),
    defaultValue: 'refrigerated',
    comment: '冰柜类型：冷冻、冷藏'
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '容量（件/盒等单位）'
  },
  used_capacity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已使用容量'
  },
  location: {
    type: DataTypes.STRING,
    comment: '存放位置'
  },
  status: {
    type: DataTypes.ENUM('active', 'maintenance', 'full'),
    defaultValue: 'active',
    comment: '状态：正常使用、维护中、已满'
  },
  note: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  tableName: 'freezers',
  comment: '冰柜表'
});

module.exports = Freezer;
