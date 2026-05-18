const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TestDrive = sequelize.define('TestDrive', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  testDriveNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '试驾编号'
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '客户姓名'
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '客户电话'
  },
  customerIdCard: {
    type: DataTypes.STRING,
    comment: '客户身份证号'
  },
  customerDriverLicense: {
    type: DataTypes.STRING,
    comment: '驾驶证号'
  },
  salesConsultant: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '销售顾问'
  },
  vehicleModel: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '试驾车型'
  },
  vehiclePlateNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '试驾车辆牌照'
  },
  vehicleVin: {
    type: DataTypes.STRING,
    comment: '车辆VIN码'
  },
  plannedRoute: {
    type: DataTypes.TEXT,
    comment: '计划试驾路线'
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '试驾开始时间'
  },
  endTime: {
    type: DataTypes.DATE,
    comment: '试驾结束时间'
  },
  startMileage: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '起步里程'
  },
  endMileage: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '结束里程'
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'scheduled',
    comment: '试驾状态'
  },
  hasAccident: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否有事故'
  }
}, {
  tableName: 'test_drives',
  timestamps: true,
  paranoid: true
});

module.exports = TestDrive;
