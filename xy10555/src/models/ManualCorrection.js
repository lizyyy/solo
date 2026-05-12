const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ManualCorrection extends Model {
  static associate(models) {
    ManualCorrection.belongsTo(models.Valuation, {
      foreignKey: 'valuation_id',
      as: 'valuation'
    });
  }
}

ManualCorrection.init({
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
  correction_type: {
    type: DataTypes.ENUM(
      '基础价格调整', '事故扣分调整', '里程异常调整',
      '检测项调整', '整备成本调整', '最终价格调整', '其他调整'
    ),
    allowNull: false,
    comment: '修正类型'
  },
  field_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '被修正字段名'
  },
  before_value: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '修正前值(JSON字符串)'
  },
  after_value: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '修正后值(JSON字符串)'
  },
  difference: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '差异说明'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '修正原因'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作人'
  },
  operation_time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '操作时间'
  },
  approval_status: {
    type: DataTypes.ENUM('待审批', '已批准', '已拒绝'),
    defaultValue: '已批准',
    comment: '审批状态'
  },
  approver: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '审批人'
  },
  approval_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '审批时间'
  },
  approval_comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '审批意见'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  sequelize,
  modelName: 'ManualCorrection',
  tableName: 'manual_corrections',
  comment: '人工修正记录'
});

module.exports = ManualCorrection;
