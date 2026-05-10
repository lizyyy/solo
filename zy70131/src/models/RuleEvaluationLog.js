const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RuleEvaluationLog = sequelize.define('RuleEvaluationLog', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false
  },
  authorizationId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'authorization_id'
  },
  materialId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'material_id'
  },
  evaluationType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'evaluation_type'
  },
  inputData: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'input_data'
  },
  evaluationSteps: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'evaluation_steps'
  },
  finalResult: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'final_result'
  },
  triggeredAction: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'triggered_action'
  },
  evaluatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'evaluated_at'
  }
}, {
  tableName: 'rule_evaluation_logs',
  timestamps: false,
  underscored: true
});

module.exports = RuleEvaluationLog;
