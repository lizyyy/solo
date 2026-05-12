const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class AccidentRecord extends Model {
  static associate(models) {
    AccidentRecord.belongsTo(models.VehicleProfile, {
      foreignKey: 'vehicle_profile_id',
      as: 'vehicle_profile'
    });
    AccidentRecord.belongsTo(models.Valuation, {
      foreignKey: 'valuation_id',
      as: 'valuation'
    });
  }
}

AccidentRecord.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vehicle_profile_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '车辆档案ID'
  },
  valuation_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '估价ID'
  },
  accident_date: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '事故日期'
  },
  accident_type: {
    type: DataTypes.ENUM('轻微事故', '一般事故', '重大事故', '水淹车', '火烧车', '结构性损伤'),
    allowNull: false,
    comment: '事故类型'
  },
  accident_severity: {
    type: DataTypes.ENUM('轻微', '一般', '严重'),
    allowNull: false,
    comment: '严重程度'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '事故描述'
  },
  damage_parts: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '受损部位(JSON字符串)'
  },
  repair_amount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '维修金额(元)'
  },
  is_structural_damage: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否结构性损伤'
  },
  is_airbag_deployed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '安全气囊是否弹出'
  },
  insurance_claim: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否走保险理赔'
  },
  claim_amount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '理赔金额(元)'
  },
  score_deduction: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    comment: '扣分值'
  },
  price_adjustment: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '价格调整(元)'
  },
  source: {
    type: DataTypes.ENUM('保险记录', '4S店记录', '车主自述', '检测发现', '其他'),
    allowNull: true,
    comment: '信息来源'
  },
  reporter: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '记录人'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  sequelize,
  modelName: 'AccidentRecord',
  tableName: 'accident_records',
  comment: '事故记录'
});

module.exports = AccidentRecord;
