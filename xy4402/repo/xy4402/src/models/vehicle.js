const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Vehicle extends Model {}

Vehicle.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  plateNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'plate_number',
    comment: '车牌号'
  },
  type: {
    type: DataTypes.STRING,
    comment: '车辆类型'
  },
  capacity: {
    type: DataTypes.FLOAT,
    comment: '载重量(吨)'
  },
  driverName: {
    type: DataTypes.STRING,
    field: 'driver_name',
    comment: '司机姓名'
  },
  driverPhone: {
    type: DataTypes.STRING,
    field: 'driver_phone',
    comment: '司机电话'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'maintenance'),
    defaultValue: 'active',
    comment: '状态: active-可用, inactive-停用, maintenance-维护中'
  }
}, {
  sequelize,
  modelName: 'Vehicle',
  tableName: 'vehicles',
  comment: '车辆信息表'
});

module.exports = Vehicle;
