const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const moment = require('moment');

class ReturnRecord extends Model {
  static associate(models) {
    ReturnRecord.belongsTo(models.Loan, {
      foreignKey: 'loan_id',
      as: 'loan',
    });
    ReturnRecord.belongsTo(models.User, {
      foreignKey: 'received_by',
      as: 'receiver',
    });
  }

  calculateOverdueHours() {
    if (!this.loan || !this.loan.expected_return_time) return 0;
    
    const returnTime = moment(this.return_time);
    const expectedReturn = moment(this.loan.expected_return_time);
    
    if (returnTime.isBefore(expectedReturn)) return 0;
    
    const diffHours = returnTime.diff(expectedReturn, 'hours', true);
    return Math.max(0, diffHours);
  }

  calculateOverdueFee() {
    const overdueHours = this.calculateOverdueHours();
    const overdueRate = this.loan?.item?.overdue_rate || 
                        parseFloat(process.env.OVERDUE_RATE_PER_HOUR) || 10;
    
    return Math.round(overdueHours * overdueRate * 100) / 100;
  }
}

ReturnRecord.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    loan_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'loans',
        key: 'id',
      },
      comment: '借出记录ID',
    },
    return_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: '实际归还时间',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '归还数量',
    },
    condition: {
      type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor', 'damaged', 'lost'),
      defaultValue: 'good',
      comment: '物品归还时的状态：完好、良好、一般、较差、损坏、丢失',
    },
    damage_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '损坏描述（如果有）',
    },
    damage_estimate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.00,
      comment: '损坏预估费用',
    },
    overdue_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '逾期小时数',
    },
    overdue_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '逾期费用',
    },
    total_deduction: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '总扣减金额（逾期费+损坏费）',
    },
    deposit_refunded: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '退还的押金金额',
    },
    received_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: '接收归还的管理员ID',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '备注',
    },
    has_dispute: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否存在争议',
    },
  },
  {
    sequelize,
    modelName: 'ReturnRecord',
    tableName: 'return_records',
    comment: '归还记录表',
    indexes: [
      { fields: ['loan_id'] },
      { fields: ['return_time'] },
      { fields: ['condition'] },
      { fields: ['has_dispute'] },
    ],
  }
);

module.exports = ReturnRecord;
