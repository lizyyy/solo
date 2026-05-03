const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Dispute extends Model {
  static associate(models) {
    Dispute.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    Dispute.belongsTo(models.Loan, {
      foreignKey: 'loan_id',
      as: 'loan',
    });
    Dispute.belongsTo(models.ReturnRecord, {
      foreignKey: 'return_record_id',
      as: 'returnRecord',
    });
    Dispute.belongsTo(models.User, {
      foreignKey: 'resolved_by',
      as: 'resolver',
    });
  }
}

Dispute.init(
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
      comment: '提出争议的用户ID',
    },
    loan_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'loans',
        key: 'id',
      },
      comment: '关联的借出记录ID',
    },
    return_record_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'return_records',
        key: 'id',
      },
      comment: '关联的归还记录ID',
    },
    type: {
      type: DataTypes.ENUM('overdue_fee', 'damage_fee', 'deposit_refund', 'condition_dispute', 'other'),
      allowNull: false,
      comment: '争议类型：逾期费、损坏费、押金退还、状态争议、其他',
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '争议标题',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '争议详细描述',
    },
    disputed_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: '争议涉及的金额',
    },
    status: {
      type: DataTypes.ENUM('open', 'investigating', 'resolved', 'closed', 'rejected'),
      defaultValue: 'open',
      comment: '争议状态：开放、调查中、已解决、已关闭、已拒绝',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium',
      comment: '优先级',
    },
    evidence: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '证据（JSON格式存储图片URL或其他证据链接）',
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '管理员备注',
    },
    resolution: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '解决方案',
    },
    resolved_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: '最终解决金额',
    },
    resolved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: '解决争议的管理员ID',
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '解决时间',
    },
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '关闭时间',
    },
  },
  {
    sequelize,
    modelName: 'Dispute',
    tableName: 'disputes',
    comment: '争议记录表',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['loan_id'] },
      { fields: ['return_record_id'] },
      { fields: ['status'] },
      { fields: ['type'] },
      { fields: ['priority'] },
      { fields: ['created_at'] },
    ],
  }
);

module.exports = Dispute;
