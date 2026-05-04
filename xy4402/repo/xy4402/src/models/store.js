const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Store extends Model {}

Store.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '门店名称'
  },
  code: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    comment: '门店编号'
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '门店地址'
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: false,
    comment: '纬度'
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: false,
    comment: '经度'
  },
  contact: {
    type: DataTypes.STRING,
    comment: '联系人'
  },
  phone: {
    type: DataTypes.STRING,
    comment: '联系电话'
  },
  contractStartDate: {
    type: DataTypes.DATE,
    field: 'contract_start_date',
    comment: '合同开始日期'
  },
  contractEndDate: {
    type: DataTypes.DATE,
    field: 'contract_end_date',
    comment: '合同结束日期'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active',
    comment: '状态: active-生效, inactive-失效, suspended-暂停'
  }
}, {
  sequelize,
  modelName: 'Store',
  tableName: 'stores',
  comment: '门店信息表'
});

module.exports = Store;
