const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const StudentFeedback = sequelize.define('StudentFeedback', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  pageNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'page_number',
  },
  studentName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'student_name',
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  feedbackTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'feedback_time',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at',
  },
}, {
  tableName: 'student_feedbacks',
  timestamps: true,
});

module.exports = StudentFeedback;
