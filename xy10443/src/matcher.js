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

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

function isSimilarNickname(nickname1, nickname2, threshold = 0.8) {
  if (!nickname1 || !nickname2) return false;
  
  if (nickname1 === nickname2) return true;
  
  const n1 = nickname1.trim().toLowerCase();
  const n2 = nickname2.trim().toLowerCase();
  
  if (n1.includes(n2) || n2.includes(n1)) {
    return true;
  }
  
  const similarity = calculateSimilarity(n1, n2);
  return similarity >= threshold;
}

function matchByPhone(lead1, lead2) {
  if (!lead1.phone || !lead2.phone) return false;
  return lead1.phone === lead2.phone;
}

function matchByWechat(lead1, lead2) {
  if (!lead1.wechat || !lead2.wechat) return false;
  return lead1.wechat === lead2.wechat;
}

function matchByNickname(lead1, lead2, threshold = 0.8) {
  return isSimilarNickname(lead1.nickname, lead2.nickname, threshold);
}

function isMatch(lead1, lead2, options = {}) {
  const { similarityThreshold = 0.8 } = options;
  
  if (matchByPhone(lead1, lead2)) {
    return { matched: true, reason: '手机号匹配' };
  }
  
  if (matchByWechat(lead1, lead2)) {
    return { matched: true, reason: '微信号匹配' };
  }
  
  if (matchByNickname(lead1, lead2, similarityThreshold)) {
    return { matched: true, reason: '昵称相似度匹配' };
  }
  
  return { matched: false, reason: '' };
}

module.exports = {
  levenshteinDistance,
  calculateSimilarity,
  isSimilarNickname,
  matchByPhone,
  matchByWechat,
  matchByNickname,
  isMatch
};
