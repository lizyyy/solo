const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class VehicleProfile extends Model {
  static associate(models) {
    VehicleProfile.hasMany(models.Valuation, {
      foreignKey: 'vehicle_profile_id',
      as: 'valuations'
    });
    VehicleProfile.hasMany(models.InspectionItem, {
      foreignKey: 'vehicle_profile_id',
      as: 'inspection_items'
    });
    VehicleProfile.hasMany(models.AccidentRecord, {
      foreignKey: 'vehicle_profile_id',
      as: 'accident_records'
    });
    VehicleProfile.hasMany(models.MileageVerification, {
      foreignKey: 'vehicle_profile_id',
      as: 'mileage_verifications'
    });
    VehicleProfile.hasMany(models.RepairCost, {
      foreignKey: 'vehicle_profile_id',
      as: 'repair_costs'
    });
  }
}

VehicleProfile.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vin: {
    type: DataTypes.STRING(17),
    allowNull: false,
    unique: true,
    comment: '车辆识别码'
  },
  license_plate: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '车牌号'
  },
  brand: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '品牌'
  },
  model: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '型号'
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '出厂年份'
  },
  mileage: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '当前里程(公里)'
  },
  displacement: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: '排量(L)'
  },
  transmission: {
    type: DataTypes.ENUM('手动', '自动', '手自一体', '无级变速'),
    allowNull: true,
    comment: '变速箱类型'
  },
  fuel_type: {
    type: DataTypes.ENUM('汽油', '柴油', '混动', '纯电动', '插电混动'),
    allowNull: true,
    comment: '燃料类型'
  },
  color: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: '颜色'
  },
  body_type: {
    type: DataTypes.ENUM('轿车', 'SUV', 'MPV', '跑车', '皮卡', '面包车'),
    allowNull: true,
    comment: '车身类型'
  },
  first_registration_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '首次上牌日期'
  },
  ownership_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '过户次数'
  },
  use_nature: {
    type: DataTypes.ENUM('非营运', '营运', '营转非', '租赁'),
    defaultValue: '非营运',
    comment: '使用性质'
  },
  market_reference_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: '市场参考价(元)'
  },
  base_valuation_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: '基础估价(元)'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  sequelize,
  modelName: 'VehicleProfile',
  tableName: 'vehicle_profiles',
  comment: '车辆档案'
});

module.exports = VehicleProfile;
