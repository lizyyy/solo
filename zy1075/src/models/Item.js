const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Item extends Model {
  static associate(models) {
    Item.hasMany(models.Reservation, {
      foreignKey: 'item_id',
      as: 'reservations',
    });
    Item.hasMany(models.Loan, {
      foreignKey: 'item_id',
      as: 'loans',
    });
    Item.hasMany(models.Waitlist, {
      foreignKey: 'item_id',
      as: 'waitlists',
    });
  }
}

Item.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '物品名称',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '物品描述',
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '物品分类（如：工具、电器、家具等）',
    },
    total_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '总数量',
    },
    available_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '当前可借数量',
    },
    status: {
      type: DataTypes.ENUM('available', 'maintenance', 'unavailable'),
      defaultValue: 'available',
      comment: '物品状态：可借、维护中、不可借',
    },
    deposit_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '押金金额',
    },
    overdue_rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 10.00,
      comment: '逾期费率（元/小时）',
    },
    max_loan_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '最长借还小时数，NULL表示无限制',
    },
    images: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '物品图片（JSON格式存储URL数组）',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '备注信息',
    },
  },
  {
    sequelize,
    modelName: 'Item',
    tableName: 'items',
    comment: '物品表',
    indexes: [
      { fields: ['name'] },
      { fields: ['category'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = Item;
