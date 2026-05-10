const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { MentorFeedbackStatus } = require('../constants');

const MentorFeedback = sequelize.define('MentorFeedback', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  probationPlanId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  mentorId: {
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
  skillProgressScore: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 0,
      max: 5
    }
  },
  attitudeScore: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 0,
      max: 5
    }
  },
  teamworkScore: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 0,
      max: 5
    }
  },
  goalsAchieved: {
    type: DataTypes.TEXT
  },
  challengesFaced: {
    type: DataTypes.TEXT
  },
  suggestions: {
    type: DataTypes.TEXT
  },
  recommendation: {
    type: DataTypes.ENUM('confirm', 'extend', 'terminate'),
    allowNull: false
  },
  additionalComments: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM(...Object.values(MentorFeedbackStatus)),
    defaultValue: MentorFeedbackStatus.PENDING
  },
  submittedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'mentor_feedbacks',
  timestamps: true,
  paranoid: true
});

module.exports = MentorFeedback;
