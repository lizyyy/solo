const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Batch = require('./batch');

class Review extends Model {}

Review.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  reviewerName: {
    type: DataTypes.STRING,
    field: 'reviewer_name',
    allowNull: false,
    comment: '复核人姓名'
  },
  reviewTime: {
    type: DataTypes.DATE,
    field: 'review_time',
    allowNull: false,
    comment: '复核时间'
  },
  comment: {
    type: DataTypes.TEXT,
    comment: '复核意见'
  },
  decision: {
    type: DataTypes.ENUM('approve', 'reject', 'pending', 'escalate'),
    allowNull: false,
    comment: '复核决定: approve-通过, reject-驳回, pending-待进一步处理, escalate-需升级处理'
  },
  attachments: {
    type: DataTypes.TEXT,
    comment: '附件JSON'
  }
}, {
  sequelize,
  modelName: 'Review',
  tableName: 'reviews',
  comment: '复核意见表'
});

Review.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });
Batch.hasMany(Review, { foreignKey: 'batchId', as: 'reviews' });

module.exports = Review;
