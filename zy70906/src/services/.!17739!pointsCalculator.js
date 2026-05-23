const store = require('../store');
const RECON_STATUS = require('../models/Reconciliation').RECON_STATUS;,econst DISCREPANCY_TYPES = require('../models/Reconciliation').DISCREPANCY_TYPES;

class PointsCalculator {
  calculateExpectedPoints(receipt, member) {
