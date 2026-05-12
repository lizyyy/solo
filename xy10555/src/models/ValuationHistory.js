const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ValuationHistory extends Model {
  static associate(models) {
    ValuationHistory.belongsTo(models.Valuation, {
      foreignKey: 'valuation_id',
      as: 'valuation'
    });
  }
}

ValuationHistory.init({
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
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作类型'
  },
  from_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '变更前状态'
  },
  to_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '变更后状态'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '操作人'
  },
  operation_time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '操作时间'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '操作原因'
  },
  failure_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '失败原因(异常处理用)'
  },
  snapshot: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '数据快照(JSON字符串)'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  sequelize,
  modelName: 'ValuationHistory',
  tableName: 'valuation_histories',
  comment: '估价历史记录'
});

module.exports = ValuationHistory;
