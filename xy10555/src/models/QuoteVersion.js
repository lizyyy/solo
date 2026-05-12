const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class QuoteVersion extends Model {
  static associate(models) {
    QuoteVersion.belongsTo(models.Valuation, {
      foreignKey: 'valuation_id',
      as: 'valuation'
    });
  }
}

QuoteVersion.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  valuation_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '估价ID'
  },
  version_no: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '版本号'
  },
  version_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '版本名称'
  },
  is_current: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否当前版本'
  },
  base_price: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '基础估价(元)'
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
  quoted_price: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '实际报价(元)'
  },
  customer_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '客户姓名'
  },
  customer_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '客户电话'
  },
  quote_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '报价时间'
  },
  quote_status: {
    type: DataTypes.ENUM('草稿', '已报价', '客户接受', '客户拒绝', '已过期'),
    defaultValue: '草稿',
    comment: '报价状态'
  },
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '报价有效期至'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '报价人'
  },
  change_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '版本变更原因'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  sequelize,
  modelName: 'QuoteVersion',
  tableName: 'quote_versions',
  comment: '报价版本'
});

module.exports = QuoteVersion;
