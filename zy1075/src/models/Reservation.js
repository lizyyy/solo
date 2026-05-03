const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const moment = require('moment');

class Reservation extends Model {
  static associate(models) {
    Reservation.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    Reservation.belongsTo(models.Item, {
      foreignKey: 'item_id',
      as: 'item',
    });
    Reservation.hasOne(models.Loan, {
      foreignKey: 'reservation_id',
      as: 'loan',
    });
    Reservation.hasMany(models.Deposit, {
      foreignKey: 'reservation_id',
      as: 'deposits',
    });
  }

  isTimeSlotOverlapping(startTime, endTime) {
    const resStart = moment(this.start_time);
    const resEnd = moment(this.end_time);
    const checkStart = moment(startTime);
    const checkEnd = moment(endTime);

    return !(checkEnd.isBefore(resStart) || checkStart.isAfter(resEnd));
  }

  isExpired() {
    const now = moment();
    const startTime = moment(this.start_time);
    const timeoutMinutes = process.env.CHECKOUT_TIMEOUT_MINUTES || 30;
    const expiredTime = startTime.add(timeoutMinutes, 'minutes');
    return now.isAfter(expiredTime) && this.status === 'confirmed';
  }
}

Reservation.init(
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
      comment: '预约用户ID',
    },
    item_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'items',
        key: 'id',
      },
      comment: '预约物品ID',
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '预约开始时间',
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '预约结束时间',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '预约数量',
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'confirmed',
        'checkout',
        'completed',
        'cancelled',
        'timeout',
        'transferred'
      ),
      defaultValue: 'confirmed',
      comment: '预约状态：待确认、已确认、已取货、已完成、已取消、超时、已转让',
    },
    deposit_held: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '冻结的押金金额',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '备注',
    },
    cancel_reason: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: '取消原因',
    },
    transferred_to: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '转让给的候补用户ID',
    },
  },
  {
    sequelize,
    modelName: 'Reservation',
    tableName: 'reservations',
    comment: '预约表',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['item_id'] },
      { fields: ['status'] },
      { fields: ['start_time'] },
      { fields: ['end_time'] },
      { fields: ['item_id', 'status'] },
    ],
  }
);

module.exports = Reservation;
