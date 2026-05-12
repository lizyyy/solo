const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Valuation extends Model {
  static associate(models) {
    Valuation.belongsTo(models.VehicleProfile, {
      foreignKey: 'vehicle_profile_id',
      as: 'vehicle_profile'
    });
    Valuation.hasMany(models.InspectionItem, {
      foreignKey: 'valuation_id',
      as: 'inspection_items'
    });
    Valuation.hasMany(models.AccidentRecord, {
      foreignKey: 'valuation_id',
      as: 'accident_records'
    });
    Valuation.hasMany(models.MileageVerification, {
      foreignKey: 'valuation_id',
      as: 'mileage_verifications'
    });
    Valuation.hasMany(models.RepairCost, {
      foreignKey: 'valuation_id',
      as: 'repair_costs'
    });
    Valuation.hasMany(models.ValuationHistory, {
      foreignKey: 'valuation_id',
      as: 'history_records'
    });
    Valuation.hasMany(models.QuoteVersion, {
      foreignKey: 'valuation_id',
      as: 'quote_versions'
    });
    Valuation.hasMany(models.ManualCorrection, {
      foreignKey: 'valuation_id',
      as: 'manual_corrections'
    });
  }
}

Valuation.init({
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
  valuation_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '估价单号'
  },
  request_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    comment: '请求ID(用于幂等)'
  },
  status: {
    type: DataTypes.ENUM(
      '草稿', '待检测', '检测中', '检测完成',
      '待审核', '审核通过', '审核驳回',
      '估价完成', '已报价', '已成交', '已作废'
    ),
    defaultValue: '草稿',
    comment: '估价状态'
  },
  base_price: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '基础估价(元)'
  },
  total_score_deduction: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '总扣分值'
  },
  accident_deduction: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '事故扣减(元)'
  },
  mileage_deduction: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '里程异常扣减(元)'
  },
  inspection_deduction: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '检测项扣减(元)'
  },
  repair_cost_total: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '整备成本总计(元)'
  },
  repair_cost_threshold: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '整备成本阈值(元)'
  },
  is_repair_cost_over_threshold: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '整备成本是否超阈值'
  },
  has_missing_inspection_items: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否存在缺失检测项'
  },
  missing_inspection_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '缺失检测项数量'
  },
  has_major_accident: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否有重大事故'
  },
  major_accident_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '重大事故次数'
  },
  has_mileage_anomaly: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否有里程异常'
  },
  mileage_anomaly_type: {
    type: DataTypes.ENUM('疑似回调', '异常待审', null),
    allowNull: true,
    comment: '里程异常类型'
  },
  final_price: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '最终估价(元)'
  },
  suggested_sale_price: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '建议售价(元)'
  },
  valuation_factors: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '估价因子明细(JSON字符串)'
  },
  deduction_reasons: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '扣分原因明细(JSON字符串)'
  },
  risk_level: {
    type: DataTypes.ENUM('低风险', '中风险', '高风险', '极高风险'),
    defaultValue: '低风险',
    comment: '风险等级'
  },
  requires_manual_review: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否需要人工审核'
  },
  current_version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '当前版本号'
  },
  creator: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '创建人'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '当前操作人'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  sequelize,
  modelName: 'Valuation',
  tableName: 'valuations',
  comment: '估价主表'
});

module.exports = Valuation;
