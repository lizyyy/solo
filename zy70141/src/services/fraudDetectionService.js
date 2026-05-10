const { Op } = require('sequelize');
const config = require('../config');
const { AccessLog, DeviceFingerprint } = require('../models');
const { calculateFingerprintSimilarity } = require('./deviceFingerprintService');
const logger = require('../utils/logger');

const FRAUD_REASONS = {
  BOT_DETECTED: 'bot_detected',
  HIGH_FREQUENCY: 'high_frequency',
  IP_BLACKLISTED: 'ip_blacklisted',
  FINGERPRINT_BLACKLISTED: 'fingerprint_blacklisted',
  SUSPICIOUS_DEVICE: 'suspicious_device',
  MULTIPLE_SIMILAR_FINGERPRINTS: 'multiple_similar_fingerprints',
  EXCESSIVE_REQUESTS: 'excessive_requests',
};

function createFraudResult(isFraud, reason, score = 0, details = {}) {
  return {
    isFraud,
    reason: isFraud ? reason : null,
    score: Math.max(0, Math.min(1, score)),
    details,
  };
}

function checkBotDetection(deviceFingerprint) {
  if (deviceFingerprint?.isBot) {
    return createFraudResult(
      true,
      FRAUD_REASONS.BOT_DETECTED,
      0.95,
      { isBot: true, userAgent: deviceFingerprint.userAgent }
    );
  }
  return createFraudResult(false, null, 0);
}

async function checkFrequencyRule(shortLinkId, ipAddress, deviceFingerprintId, transaction = null) {
  const timeWindow = config.fraud.timeWindowSeconds;
  const threshold = config.fraud.frequencyThreshold;
  
  const windowStart = new Date(Date.now() - timeWindow * 1000);
  
  const recentAccessCount = await AccessLog.count({
    where: {
      shortLinkId,
      [Op.or]: [
        { ipAddress },
        { deviceFingerprintId },
      ],
      createdAt: { [Op.gte]: windowStart },
    },
    transaction,
  });
  
  if (recentAccessCount >= threshold) {
    return createFraudResult(
      true,
      FRAUD_REASONS.HIGH_FREQUENCY,
      Math.min(1, recentAccessCount / threshold),
      {
        recentAccessCount,
        threshold,
        timeWindowSeconds: timeWindow,
      }
    );
  }
  
  return createFraudResult(
    false,
    null,
    recentAccessCount / threshold * 0.5,
    { recentAccessCount, threshold }
  );
}

async function checkDeviceFingerprintHistory(deviceFingerprint, transaction = null) {
  if (!deviceFingerprint) {
    return createFraudResult(false, null, 0);
  }
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const recentAccessCount = await AccessLog.count({
    where: {
      deviceFingerprintId: deviceFingerprint.id,
      createdAt: { [Op.gte]: oneHourAgo },
      isFraud: false,
    },
    transaction,
  });
  
  const ipMaxRequests = config.fraud.ipMaxRequests;
  
  if (recentAccessCount >= ipMaxRequests) {
    return createFraudResult(
      true,
      FRAUD_REASONS.EXCESSIVE_REQUESTS,
      Math.min(1, recentAccessCount / ipMaxRequests),
      {
        recentAccessCount,
        ipMaxRequests,
        deviceFingerprint: deviceFingerprint.fingerprint,
      }
    );
  }
  
  if (deviceFingerprint.totalRequests > 100 && deviceFingerprint.isBot) {
    return createFraudResult(
      true,
      FRAUD_REASONS.SUSPICIOUS_DEVICE,
      0.8,
      {
        totalRequests: deviceFingerprint.totalRequests,
        isBot: deviceFingerprint.isBot,
      }
    );
  }
  
  return createFraudResult(
    false,
    null,
    Math.min(0.3, recentAccessCount / ipMaxRequests),
    { recentAccessCount }
  );
}

async function checkSimilarFingerprints(deviceFingerprint, shortLinkId, transaction = null) {
  if (!deviceFingerprint) {
    return createFraudResult(false, null, 0);
  }
  
  const similarityThreshold = config.fraud.fingerprintSimilarityThreshold;
  const timeWindow = 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - timeWindow);
  
  const recentFingerprints = await DeviceFingerprint.findAll({
    where: {
      lastSeenAt: { [Op.gte]: windowStart },
      id: { [Op.ne]: deviceFingerprint.id },
    },
    include: [{
      model: AccessLog,
      as: 'accessLogs',
      where: {
        shortLinkId,
        createdAt: { [Op.gte]: windowStart },
      },
      required: true,
      separate: true,
    }],
    transaction,
    limit: 100,
  });
  
  let similarCount = 0;
  const similarFingerprints = [];
  
  for (const fp of recentFingerprints) {
    const similarity = calculateFingerprintSimilarity(
      deviceFingerprint.fingerprintData,
      fp.fingerprintData
    );
    
    if (similarity >= similarityThreshold) {
      similarCount++;
      similarFingerprints.push({
        fingerprint: fp.fingerprint,
        similarity,
      });
    }
  }
  
  if (similarCount >= 3) {
    return createFraudResult(
      true,
      FRAUD_REASONS.MULTIPLE_SIMILAR_FINGERPRINTS,
      Math.min(1, similarCount / 5),
      {
        similarCount,
        similarityThreshold,
        similarFingerprints: similarFingerprints.slice(0, 5),
      }
    );
  }
  
  return createFraudResult(
    false,
    null,
    similarCount / 10,
    { similarCount }
  );
}

function aggregateFraudResults(results) {
  let isFraud = false;
  let totalScore = 0;
  const reasons = [];
  const details = {};
  
  for (const result of results) {
    if (result.isFraud) {
      isFraud = true;
      reasons.push(result.reason);
    }
    totalScore += result.score;
    Object.assign(details, result.details);
  }
  
  const finalScore = Math.min(1, totalScore / Math.max(1, results.length));
  
  return {
    isFraud,
    reasons,
    score: finalScore,
    details,
    primaryReason: reasons[0] || null,
  };
}

async function checkBlacklist(ipAddress, fingerprint, blacklistService) {
  const ipBlacklist = await blacklistService.check('ip', ipAddress);
  if (ipBlacklist) {
    return createFraudResult(
      true,
      FRAUD_REASONS.IP_BLACKLISTED,
      1.0,
      { ipAddress, severity: ipBlacklist.severity }
    );
  }
  
  const fingerprintBlacklist = await blacklistService.check('fingerprint', fingerprint);
  if (fingerprintBlacklist) {
    return createFraudResult(
      true,
      FRAUD_REASONS.FINGERPRINT_BLACKLISTED,
      1.0,
      { fingerprint, severity: fingerprintBlacklist.severity }
    );
  }
  
  return createFraudResult(false, null, 0);
}

async function detectFraud(options) {
  const {
    shortLinkId,
    ipAddress,
    deviceFingerprint,
    blacklistService,
    transaction = null,
  } = options;
  
  const results = [];
  
  logger.debug('Starting fraud detection', {
    shortLinkId,
    ipAddress,
    fingerprintId: deviceFingerprint?.id,
  });
  
  const botResult = checkBotDetection(deviceFingerprint);
  results.push(botResult);
  
  if (blacklistService && deviceFingerprint) {
    const blacklistResult = await checkBlacklist(
      ipAddress,
      deviceFingerprint.fingerprint,
      blacklistService
    );
    results.push(blacklistResult);
  }
  
  const frequencyResult = await checkFrequencyRule(
    shortLinkId,
    ipAddress,
    deviceFingerprint?.id,
    transaction
  );
  results.push(frequencyResult);
  
  const deviceHistoryResult = await checkDeviceFingerprintHistory(
    deviceFingerprint,
    transaction
  );
  results.push(deviceHistoryResult);
  
  const similarFpResult = await checkSimilarFingerprints(
    deviceFingerprint,
    shortLinkId,
    transaction
  );
  results.push(similarFpResult);
  
  const finalResult = aggregateFraudResults(results);
  
  logger.debug('Fraud detection complete', {
    isFraud: finalResult.isFraud,
    score: finalResult.score,
    reasons: finalResult.reasons,
  });
  
  return finalResult;
}

module.exports = {
  FRAUD_REASONS,
  createFraudResult,
  checkBotDetection,
  checkFrequencyRule,
  checkDeviceFingerprintHistory,
  checkSimilarFingerprints,
  aggregateFraudResults,
  checkBlacklist,
  detectFraud,
};
