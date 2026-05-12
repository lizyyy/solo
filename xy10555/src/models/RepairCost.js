const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class RepairCost extends Model {
  static associate(models) {
    RepairCost.belongsTo(models.VehicleProfile, {
      foreignKey: 'vehicle_profile_id',
      as: 'vehicle_profile'
    });
    RepairCost.belongsTo(models.Valuation, {
      foreignKey: 'valuation_id',
      as: 'valuation'
    });
  }
}

RepairCost.init({
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
  category: {
    type: DataTypes.ENUM(
      '外观修复', '内饰清洗', '机械维修', '电气维修',
      '保养维护', '轮胎更换', '钣金喷漆', '其他整备'
    ),
    allowNull: false,
    comment: '整备分类'
  },
  item_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '整备项目名称'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '整备详情'
  },
  estimated_cost: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: '预估费用(元)'
  },
  actual_cost: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '实际费用(元)'
  },
  priority: {
    type: DataTypes.ENUM('必须', '建议', '可选'),
    defaultValue: '建议',
    comment: '优先级'
  },
  is_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已完成'
  },
  completion_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '完成时间'
  },
  contractor: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '施工方'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  sequelize,
  modelName: 'RepairCost',
  tableName: 'repair_costs',
  comment: '整备成本'
});

module.exports = RepairCost;
