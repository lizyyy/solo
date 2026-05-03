const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class User extends Model {
  static associate(models) {
    User.hasMany(models.Reservation, {
      foreignKey: 'user_id',
      as: 'reservations',
    });
    User.hasMany(models.Loan, {
      foreignKey: 'user_id',
      as: 'loans',
    });
    User.hasMany(models.Waitlist, {
      foreignKey: 'user_id',
      as: 'waitlists',
    });
    User.hasMany(models.Deposit, {
      foreignKey: 'user_id',
      as: 'deposits',
    });
    User.hasMany(models.Dispute, {
      foreignKey: 'user_id',
      as: 'disputes',
    });
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '用户姓名',
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
      comment: '手机号',
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
      comment: '邮箱',
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user',
      comment: '角色：普通用户或管理员',
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      comment: '账户余额（用于押金、逾期费等）',
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'blacklisted'),
      defaultValue: 'active',
      comment: '用户状态：活跃、暂停、黑名单',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    comment: '用户表',
    indexes: [
      { fields: ['phone'] },
      { fields: ['email'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = User;
