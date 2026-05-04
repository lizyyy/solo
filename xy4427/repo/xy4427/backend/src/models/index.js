const sequelize = require('../database');

const OriginalText = require('./OriginalText');
const BrailleProofreading = require('./BrailleProofreading');
const TemperatureCurve = require('./TemperatureCurve');
const StudentFeedback = require('./StudentFeedback');
const RiskDetection = require('./RiskDetection');
const ReviewRecord = require('./ReviewRecord');

const models = {
  OriginalText,
  BrailleProofreading,
  TemperatureCurve,
  StudentFeedback,
  RiskDetection,
  ReviewRecord,
  sequelize,
};

module.exports = models;
