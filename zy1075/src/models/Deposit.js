const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Deposit extends Model {
  static associate(models) {
    Deposit.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    Deposit.belongsTo(models.Loan, {
      foreignKey: 'loan_id',
      as: 'loan',
    });
    Deposit.belongsTo(models.Reservation, {
      foreignKey: 'reservation_id',
      as: 'reservation',
    });
  }
}

Deposit.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: '用户ID',
    },
    loan_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'loans',
        key: 'id',
      },
      comment: '关联的借出记录ID',
    },
    reservation_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'reservations',
        key: 'id',
      },
      comment: '关联的预约ID',
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '押金金额',
    },
    status: {
      type: DataTypes.ENUM('held', 'refunded', 'partially_refunded', 'deducted'),
      defaultValue: 'held',
      comment: '押金状态：冻结中、已退还、部分退还、已扣除',
    },
    refunded_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '已退还金额',
    },
    deducted_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '已扣除金额',
    },
    deduction_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '扣除原因（如：逾期费、损坏赔偿等）',
    },
    held_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: '冻结时间',
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '处理时间（退还或扣除）',
    },
    processed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: '处理人ID（管理员）',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '备注',
    },
  },
  {
    sequelize,
    modelName: 'Deposit',
    tableName: 'deposits',
    comment: '押金记录表',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['loan_id'] },
      { fields: ['reservation_id'] },
      { fields: ['status'] },
      { fields: ['held_at'] },
    ],
  }
);

module.exports = Deposit;
