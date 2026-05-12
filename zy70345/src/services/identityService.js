const { db } = require('../database');

const verifyCustomerIdentity = (customerId, verificationInfo) => {
  const profile = db.prepare(`
    SELECT * FROM mock_user_profiles WHERE customer_id = ?
  `).get(customerId);

  if (!profile) {
    return {
      verified: false,
      reason: '客户不存在'
    };
  }

  if (!verificationInfo) {
    return {
      verified: false,
      reason: '未提供验证信息'
    };
  }

  const { email, phone, name } = verificationInfo;
  
  let matchCount = 0;
  const mismatches = [];

  if (email) {
    if (profile.email === email) {
      matchCount++;
    } else {
      mismatches.push('邮箱不匹配');
    }
  }

  if (phone) {
    if (profile.phone === phone) {
      matchCount++;
    } else {
      mismatches.push('手机号不匹配');
    }
  }

  if (name) {
    if (profile.name === name) {
      matchCount++;
    } else {
      mismatches.push('姓名不匹配');
    }
  }

  const requiredMatches = 2;
  
  if (matchCount >= requiredMatches) {
    return {
      verified: true,
      reason: '身份验证通过'
    };
  } else {
    return {
      verified: false,
      reason: mismatches.length > 0 ? mismatches.join('；') : '验证信息不足，需要至少2项验证'
    };
  }
};

const getCustomerProfile = (customerId) => {
  return db.prepare(`
    SELECT * FROM mock_user_profiles WHERE customer_id = ?
  `).get(customerId);
};

module.exports = {
  verifyCustomerIdentity,
  getCustomerProfile
};
