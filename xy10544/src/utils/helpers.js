const { v4: uuidv4 } = require('uuid');
const { HAZARD_STATUS, LEVEL_LABELS, STATUS_LABELS, FINE_AMOUNTS, REVIEW_RESULT_LABELS } = require('./constants');
const { readData } = require('./storage');
const chalk = require('chalk');

function generateId() {
  return uuidv4().substring(0, 8);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function getDaysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = endDate - startDate;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return Math.ceil(diffDays * 10) / 10;
}

function getHazardById(hazardId) {
  const hazards = readData('hazards');
  return hazards.find(h => h.id === hazardId);
}

function getRectificationsByHazard(hazardId) {
  const rectifications = readData('rectifications');
  return rectifications.filter(r => r.hazardId === hazardId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function getReviewsByHazard(hazardId) {
  const reviews = readData('reviews');
  return reviews.filter(r => r.hazardId === hazardId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function getFinesByHazard(hazardId) {
  const fines = readData('fines');
  return fines.filter(f => f.hazardId === hazardId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function getTeamById(teamId) {
  const teams = readData('teams');
  return teams.find(t => t.id === teamId);
}

function calculateFine(hazard, rectification, review) {
  const baseFine = FINE_AMOUNTS[hazard.level] || 0;
  
  const reviewCount = getReviewsByHazard(hazard.id).filter(r => r.result === 'failed').length;
  const rectificationCount = getRectificationsByHazard(hazard.id).length;
  
  let multiplier = 1;
  if (reviewCount > 1) {
    multiplier += (reviewCount - 1) * 0.5;
  }
  
  return Math.floor(baseFine * multiplier);
}

function checkDuplicateHazard(hazardData, excludeId = null) {
  const hazards = readData('hazards');
  return hazards.find(h => {
    if (excludeId && h.id === excludeId) return false;
    if (h.status === HAZARD_STATUS.CLOSED) return false;
    
    const locationMatch = h.location === hazardData.location;
    const typeMatch = h.type === hazardData.type;
    const descriptionMatch = h.description === hazardData.description || 
      similarity(h.description, hazardData.description) > 0.7;
    
    return locationMatch && typeMatch && descriptionMatch;
  });
}

function similarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a, b) {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function colorizeStatus(status) {
  switch (status) {
    case HAZARD_STATUS.DISCOVERED:
      return chalk.yellow.bold(STATUS_LABELS[status]);
    case HAZARD_STATUS.RECTIFYING:
      return chalk.blue.bold(STATUS_LABELS[status]);
    case HAZARD_STATUS.PENDING_REVIEW:
      return chalk.cyan.bold(STATUS_LABELS[status]);
    case HAZARD_STATUS.REOPENED:
      return chalk.magenta.bold(STATUS_LABELS[status]);
    case HAZARD_STATUS.CLOSED:
      return chalk.green.bold(STATUS_LABELS[status]);
    default:
      return status;
  }
}

function colorizeLevel(level) {
  switch (level) {
    case 'minor':
      return chalk.green(LEVEL_LABELS[level]);
    case 'general':
      return chalk.yellow(LEVEL_LABELS[level]);
    case 'major':
      return chalk.red(LEVEL_LABELS[level]);
    case 'critical':
      return chalk.red.bold(LEVEL_LABELS[level]);
    default:
      return level;
  }
}

function colorizeReviewResult(result) {
  return result === 'passed' 
    ? chalk.green(REVIEW_RESULT_LABELS[result])
    : chalk.red(REVIEW_RESULT_LABELS[result]);
}

module.exports = {
  generateId,
  formatDate,
  formatDateTime,
  getDaysBetween,
  getHazardById,
  getRectificationsByHazard,
  getReviewsByHazard,
  getFinesByHazard,
  getTeamById,
  calculateFine,
  checkDuplicateHazard,
  colorizeStatus,
  colorizeLevel,
  colorizeReviewResult
};
