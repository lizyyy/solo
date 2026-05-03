const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const moment = require('moment');

class Loan extends Model {
  static associate(models) {
    Loan.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    Loan.belongsTo(models.Item, {
      foreignKey: 'item_id',
      as: 'item',
    });
    Loan.belongsTo(models.Reservation, {
      foreignKey: 'reservation_id',
      as: 'reservation',
    });
    Loan.hasOne(models.ReturnRecord, {
      foreignKey: 'loan_id',
      as: 'returnRecord',
    });
    Loan.hasMany(models.Dispute, {
      foreignKey: 'loan_id',
      as: 'disputes',
    });
  }

  calculateOverdueHours() {
    if (!this.expected_return_time) return 0;
    
    const now = moment();
    const expectedReturn = moment(this.expected_return_time);
    
    if (now.isBefore(expectedReturn)) return 0;
    
    const diffHours = now.diff(expectedReturn, 'hours', true);
    return Math.max(0, diffHours);
  }

  isOverdue() {
    return this.calculateOverdueHours() > 0 && this.status === 'active';
  }
}

Loan.init(
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
      comment: '借出用户ID',
    },
    item_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'items',
        key: 'id',
      },
      comment: '借出物品ID',
    },
    reservation_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'reservations',
        key: 'id',
      },
      comment: '关联的预约ID（可能为空，如直接借出）',
    },
    checkout_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: '取货时间',
    },
    expected_return_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '预计归还时间',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '借出数量',
    },
    status: {
      type: DataTypes.ENUM('active', 'returned', 'overdue', 'lost'),
      defaultValue: 'active',
      comment: '借出状态：借出中、已归还、逾期、丢失',
    },
    deposit_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '押金金额',
    },
    checkout_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '取货时的备注（如物品状态）',
    },
    checked_out_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: '管理员确认取货的用户ID',
    },
  },
  {
    sequelize,
    modelName: 'Loan',
    tableName: 'loans',
    comment: '借出记录表',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['item_id'] },
      { fields: ['reservation_id'] },
      { fields: ['status'] },
      { fields: ['expected_return_time'] },
    ],
  }
);

module.exports = Loan;
