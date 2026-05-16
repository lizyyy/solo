const { get, all } = require('../config/database');

const RISK_RULES = {
  UNKNOWN_DEVICE: 30,
  UNKNOWN_LOCATION: 25,
  CROSS_REGION_LOGIN: 35,
  SUSPICIOUS_TIME: 15,
  MULTI_IP_LOGIN: 30,
  DEVICE_MISMATCH: 40,
  IP_BLACKLIST: 50,
  ABNORMAL_BEHAVIOR: 35
};

const calculateRiskLevel = (score) => {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

const compareDeviceFingerprints = (fp1, fp2) => {
  let similarity = 0;
  let totalChecks = 0;

  if (fp1.fingerprint_hash && fp2.fingerprint_hash) {
    totalChecks++;
    similarity += fp1.fingerprint_hash === fp2.fingerprint_hash ? 2 : 0;
  }

  const fields = ['user_agent', 'screen_resolution', 'timezone', 
                  'language', 'platform', 'canvas_fingerprint', 
                  'webgl_fingerprint'];

  fields.forEach(field => {
    if (fp1[field] && fp2[field]) {
      totalChecks++;
      similarity += fp1[field] === fp2[field] ? 1 : 0;
    }
  });

  return totalChecks > 0 ? similarity / totalChecks : 0;
};

const isKnownDevice = async (accountId, fingerprint) => {
  const devices = await all(
    'SELECT * FROM device_fingerprints WHERE account_id = ?',
    [accountId]
  );

  for (const device of devices) {
    const similarity = compareDeviceFingerprints(device, fingerprint);
    if (similarity >= 0.85) {
      return { isKnown: true, device, similarity };
    }
  }
  return { isKnown: false, device: null, similarity: 0 };
};

const isKnownLocation = async (accountId, ipAddress) => {
  const location = await get(
    'SELECT * FROM login_locations WHERE account_id = ? AND ip_address = ?',
    [accountId, ipAddress]
  );
  return !!location;
};

const isCrossRegionLogin = async (accountId, currentCity) => {
  const recentLocations = await all(
    'SELECT DISTINCT city FROM login_locations WHERE account_id = ? ORDER BY last_seen DESC LIMIT 3',
    [accountId]
  );

  if (recentLocations.length === 0) return false;
  
  return !recentLocations.some(loc => loc.city === currentCity);
};

const calculateRiskScore = async (accountId, loginData) => {
  let score = 0;
  const appliedRules = [];

  const deviceCheck = await isKnownDevice(accountId, loginData.device_fingerprint);
  if (!deviceCheck.isKnown) {
    score += RISK_RULES.UNKNOWN_DEVICE;
    appliedRules.push({
      rule: 'UNKNOWN_DEVICE',
      weight: RISK_RULES.UNKNOWN_DEVICE,
      reason: '未知设备登录'
    });
  }

  const locationKnown = await isKnownLocation(accountId, loginData.ip_address);
  if (!locationKnown) {
    score += RISK_RULES.UNKNOWN_LOCATION;
    appliedRules.push({
      rule: 'UNKNOWN_LOCATION',
      weight: RISK_RULES.UNKNOWN_LOCATION,
      reason: '未知登录地点'
    });
  }

  if (loginData.location?.city) {
    const crossRegion = await isCrossRegionLogin(accountId, loginData.location.city);
    if (crossRegion) {
      score += RISK_RULES.CROSS_REGION_LOGIN;
      appliedRules.push({
        rule: 'CROSS_REGION_LOGIN',
        weight: RISK_RULES.CROSS_REGION_LOGIN,
        reason: '跨区域登录'
      });
    }
  }

  if (loginData.ip_blacklisted) {
    score += RISK_RULES.IP_BLACKLIST;
    appliedRules.push({
      rule: 'IP_BLACKLIST',
      weight: RISK_RULES.IP_BLACKLIST,
      reason: 'IP在黑名单中'
    });
  }

  if (score === 0) {
    score = 10;
    appliedRules.push({
      rule: 'BASELINE',
      weight: 10,
      reason: '基础风险分'
    });
  }

  return {
    score: Math.min(score, 100),
    level: calculateRiskLevel(score),
    appliedRules
  };
};

module.exports = {
  calculateRiskScore,
  calculateRiskLevel,
  compareDeviceFingerprints,
  isKnownDevice,
  isKnownLocation,
  RISK_RULES
};
