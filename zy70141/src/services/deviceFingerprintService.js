const crypto = require('crypto');
const config = require('../config');
const { DeviceFingerprint } = require('../models');
const logger = require('../utils/logger');

const BOT_UA_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /java/i,
  /node/i,
  /go-http-client/i,
  /apache/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /googlebot/i,
  /bingbot/i,
  /slackbot/i,
  /discordbot/i,
];

const MOBILE_UA_PATTERNS = [
  /android/i,
  /iphone/i,
  /ipad/i,
  /ipod/i,
  /mobile/i,
  /tablet/i,
];

function extractFingerprintComponents(req) {
  const headers = req.headers || {};
  
  return {
    ipAddress: getClientIP(req),
    userAgent: headers['user-agent'] || '',
    acceptLanguage: headers['accept-language'] || '',
    acceptEncoding: headers['accept-encoding'] || '',
    accept: headers['accept'] || '',
    connection: headers['connection'] || '',
    host: headers['host'] || '',
    referer: headers['referer'] || '',
    platform: headers['sec-ch-ua-platform'] || '',
    mobile: headers['sec-ch-ua-mobile'] || '',
    dnt: headers['dnt'] || '',
  };
}

function getClientIP(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }
  
  return req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
}

function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim();
}

function isBot(userAgent) {
  if (!userAgent) return true;
  
  for (const pattern of BOT_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }
  return false;
}

function isMobileDevice(userAgent) {
  if (!userAgent) return false;
  
  for (const pattern of MOBILE_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }
  return false;
}

function parseUserAgent(userAgent) {
  const result = {
    browser: 'unknown',
    browserVersion: 'unknown',
    os: 'unknown',
    osVersion: 'unknown',
  };
  
  if (!userAgent) return result;
  
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    const match = userAgent.match(/Chrome\/(\d+\.\d+)/);
    result.browser = 'Chrome';
    result.browserVersion = match ? match[1] : 'unknown';
  } else if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
    result.browser = 'Firefox';
    result.browserVersion = match ? match[1] : 'unknown';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/(\d+\.\d+)/);
    result.browser = 'Safari';
    result.browserVersion = match ? match[1] : 'unknown';
  } else if (userAgent.includes('Edg')) {
    const match = userAgent.match(/Edg\/(\d+\.\d+)/);
    result.browser = 'Edge';
    result.browserVersion = match ? match[1] : 'unknown';
  }
  
  if (userAgent.includes('Windows')) {
    const match = userAgent.match(/Windows NT (\d+\.\d+)/);
    result.os = 'Windows';
    result.osVersion = match ? match[1] : 'unknown';
  } else if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
    result.os = 'macOS';
    result.osVersion = match ? match[1].replace(/_/g, '.') : 'unknown';
  } else if (userAgent.includes('Android')) {
    const match = userAgent.match(/Android (\d+\.?\d*)/);
    result.os = 'Android';
    result.osVersion = match ? match[1] : 'unknown';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    const match = userAgent.match(/OS (\d+[._]\d+[._]?\d*)/);
    result.os = 'iOS';
    result.osVersion = match ? match[1].replace(/_/g, '.') : 'unknown';
  }
  
  return result;
}

function generateFingerprintHash(components) {
  const fingerprintData = [
    normalizeString(components.ipAddress),
    normalizeString(components.userAgent),
    normalizeString(components.acceptLanguage),
    normalizeString(components.acceptEncoding),
    normalizeString(components.platform),
    normalizeString(components.mobile),
    normalizeString(components.dnt),
  ].join('|');
  
  const hmac = crypto.createHmac('sha256', config.security.deviceFingerprintSecret);
  hmac.update(fingerprintData);
  return hmac.digest('hex');
}

function calculateFingerprintSimilarity(fp1, fp2) {
  if (!fp1 || !fp2) return 0;
  
  let matches = 0;
  let total = 0;
  
  const fields = ['ipAddress', 'userAgent', 'acceptLanguage', 'acceptEncoding', 'platform'];
  
  for (const field of fields) {
    total++;
    if (normalizeString(fp1[field]) === normalizeString(fp2[field])) {
      matches++;
    }
  }
  
  return total > 0 ? matches / total : 0;
}

async function getOrCreateDeviceFingerprint(req, transaction = null) {
  const components = extractFingerprintComponents(req);
  const fingerprintHash = generateFingerprintHash(components);
  const parsedUA = parseUserAgent(components.userAgent);
  
  const existingFingerprint = await DeviceFingerprint.findOne({
    where: { fingerprint: fingerprintHash },
    transaction,
  });
  
  if (existingFingerprint) {
    await existingFingerprint.update({
      lastSeenAt: new Date(),
      totalRequests: existingFingerprint.totalRequests + 1,
    }, { transaction });
    
    logger.debug('Existing device fingerprint found', {
      fingerprint: fingerprintHash,
      ipAddress: components.ipAddress,
    });
    
    return existingFingerprint;
  }
  
  const newFingerprint = await DeviceFingerprint.create({
    fingerprint: fingerprintHash,
    ipAddress: components.ipAddress,
    userAgent: components.userAgent,
    acceptLanguage: components.acceptLanguage,
    acceptEncoding: components.acceptEncoding,
    platform: components.platform,
    browser: parsedUA.browser,
    browserVersion: parsedUA.browserVersion,
    os: parsedUA.os,
    osVersion: parsedUA.osVersion,
    isMobile: isMobileDevice(components.userAgent),
    isBot: isBot(components.userAgent),
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    totalRequests: 1,
    fingerprintData: components,
  }, { transaction });
  
  logger.debug('New device fingerprint created', {
    fingerprint: fingerprintHash,
    ipAddress: components.ipAddress,
    isBot: newFingerprint.isBot,
  });
  
  return newFingerprint;
}

module.exports = {
  extractFingerprintComponents,
  getClientIP,
  normalizeString,
  isBot,
  isMobileDevice,
  parseUserAgent,
  generateFingerprintHash,
  calculateFingerprintSimilarity,
  getOrCreateDeviceFingerprint,
};
