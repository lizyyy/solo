const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class InspectionItem extends Model {
  static associate(models) {
    InspectionItem.belongsTo(models.VehicleProfile, {
      foreignKey: 'vehicle_profile_id',
      as: 'vehicle_profile'
    });
    InspectionItem.belongsTo(models.Valuation, {
      foreignKey: 'valuation_id',
      as: 'valuation'
    });
  }
}

InspectionItem.init({
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
      '外观', '内饰', '发动机', '变速箱', '底盘',
      '电气系统', '安全系统', '行驶系统', '其他'
    ),
    allowNull: false,
    comment: '检测分类'
  },
  item_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '检测项名称'
  },
  item_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '检测项编码'
  },
  inspection_result: {
    type: DataTypes.ENUM('正常', '轻微异常', '中度异常', '严重异常', '未检测'),
    defaultValue: '未检测',
    comment: '检测结果'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '详细描述'
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
  inspector: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '检测人'
  },
  inspection_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '检测时间'
  },
  image_urls: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '图片URL列表(JSON字符串)'
  },
  is_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否必填检测项'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  sequelize,
  modelName: 'InspectionItem',
  tableName: 'inspection_items',
  comment: '检测项'
});

module.exports = InspectionItem;
