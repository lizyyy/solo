const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class MileageVerification extends Model {
  static associate(models) {
    MileageVerification.belongsTo(models.VehicleProfile, {
      foreignKey: 'vehicle_profile_id',
      as: 'vehicle_profile'
    });
    MileageVerification.belongsTo(models.Valuation, {
      foreignKey: 'valuation_id',
      as: 'valuation'
    });
  }
}

MileageVerification.init({
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
  reported_mileage: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '当前报告里程(公里)'
  },
  historical_mileages: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '历史里程记录(JSON字符串数组)'
  },
  expected_mileage: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '预期正常里程(公里)'
  },
  mileage_deviation: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '里程偏差(公里)'
  },
  deviation_percentage: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '偏差百分比'
  },
  verification_result: {
    type: DataTypes.ENUM('正常', '疑似回调', '异常待审', '无法确认'),
    defaultValue: '正常',
    comment: '校验结果'
  },
  verification_method: {
    type: DataTypes.ENUM('OBD读取', '保养记录', '保险记录', '年限估算', '综合判断'),
    allowNull: true,
    comment: '校验方式'
  },
  evidence: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '证据说明'
  },
  is_rollback_suspected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否疑似调表'
  },
  rollback_suspected_amount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '疑似回调里程(公里)'
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
  verifier: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '校验人'
  },
  verification_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '校验时间'
  },
  requires_manual_review: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否需要人工审核'
  },
  review_status: {
    type: DataTypes.ENUM('待审核', '审核通过', '审核驳回'),
    allowNull: true,
    comment: '审核状态'
  },
  reviewer: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '审核人'
  },
  review_comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '审核意见'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  sequelize,
  modelName: 'MileageVerification',
  tableName: 'mileage_verifications',
  comment: '里程校验'
});

module.exports = MileageVerification;
