const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { EvaluationStatus } = require('../constants');

const PerformanceEvaluation = sequelize.define('PerformanceEvaluation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  probationPlanId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  evaluatorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  overallScore: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: false,
    validate: {
      min: 0,
      max: 5
    }
  },
  workQualityScore: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 0,
      max: 5
    }
  },
  workEfficiencyScore: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 0,
      max: 5
    }
  },
  collaborationScore: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 0,
      max: 5
    }
  },
  learningAbilityScore: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 0,
      max: 5
    }
  },
  comments: {
    type: DataTypes.TEXT
  },
  strengths: {
    type: DataTypes.TEXT
  },
  areasForImprovement: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM(...Object.values(EvaluationStatus)),
    defaultValue: EvaluationStatus.PENDING
  },
  submittedAt: {
    type: DataTypes.DATE
  },
  approvedBy: {
    type: DataTypes.UUID
  },
  approvedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'performance_evaluations',
  timestamps: true,
  paranoid: true
});

module.exports = PerformanceEvaluation;
