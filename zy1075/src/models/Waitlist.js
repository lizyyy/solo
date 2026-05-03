const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Waitlist extends Model {
  static associate(models) {
    Waitlist.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    Waitlist.belongsTo(models.Item, {
      foreignKey: 'item_id',
      as: 'item',
    });
    Waitlist.belongsTo(models.Reservation, {
      foreignKey: 'original_reservation_id',
      as: 'originalReservation',
    });
    Waitlist.belongsTo(models.Reservation, {
      foreignKey: 'converted_reservation_id',
      as: 'convertedReservation',
    });
  }
}

Waitlist.init(
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
      comment: '候补用户ID',
    },
    item_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'items',
        key: 'id',
      },
      comment: '候补物品ID',
    },
    original_reservation_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'reservations',
        key: 'id',
      },
      comment: '用户原本想预约但被占用的预约ID（可选）',
    },
    converted_reservation_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'reservations',
        key: 'id',
      },
      comment: '转换后的预约ID（候补成功后）',
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '在候补队列中的位置',
    },
    requested_start_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '用户希望的开始时间',
    },
    requested_end_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '用户希望的结束时间',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '候补数量',
    },
    status: {
      type: DataTypes.ENUM('waiting', 'converted', 'expired', 'cancelled'),
      defaultValue: 'waiting',
      comment: '候补状态：等待中、已转换、已过期、已取消',
    },
    convert_reason: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: '候补成功的原因（如：原预约取消、超时未取等）',
    },
    converted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '候补成功的时间',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '备注',
    },
  },
  {
    sequelize,
    modelName: 'Waitlist',
    tableName: 'waitlists',
    comment: '候补表',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['item_id'] },
      { fields: ['status'] },
      { fields: ['position'] },
      { fields: ['item_id', 'status', 'position'] },
      { fields: ['requested_start_time'] },
    ],
  }
);

module.exports = Waitlist;
