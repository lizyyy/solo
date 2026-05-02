const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Issue extends Model {}

Issue.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shift: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['白班', '晚班']],
      },
    },
    assignee: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    customer: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ticketNo: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'ticket_no',
    },
    riskLevel: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['低', '中', '高', '紧急']],
      },
      field: 'risk_level',
    },
    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue('tags');
        return raw ? JSON.parse(raw) : [];
      },
      set(val) {
        this.setDataValue('tags', val ? JSON.stringify(val) : '[]');
      },
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '待处理',
      validate: {
        isIn: [['待处理', '处理中', '待复盘', '已关闭']],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    modelName: 'Issue',
    tableName: 'issues',
    timestamps: true,
  }
);

module.exports = Issue;
