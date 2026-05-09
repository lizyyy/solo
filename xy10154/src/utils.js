const dayjs = require('dayjs');
const crypto = require('crypto');

function parseDate(dateStr) {
  const formats = [
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD HH:mm',
    'YYYY-MM-DD',
    'YYYY/MM/DD HH:mm:ss',
    'YYYY/MM/DD HH:mm',
    'YYYY/MM/DD'
  ];
  
  for (const format of formats) {
    const parsed = dayjs(dateStr, format);
    if (parsed.isValid()) {
      return parsed;
    }
  }
  
  return dayjs(dateStr);
}

function formatDate(date) {
  if (!date) return '';
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

function generateHash(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex');
}

function generateId() {
  return crypto.randomUUID();
}

function extractCity(location) {
  if (!location) return null;
  
  const majorCities = [
    '北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都', '重庆',
    '武汉', '西安', '天津', '郑州', '长沙', '青岛', '大连', '厦门', '福州',
    '济南', '合肥', '南昌', '南宁', '昆明', '贵阳', '兰州', '西宁', '银川',
    '乌鲁木齐', '拉萨', '海口', '三亚', '嘉兴', '宁波', '无锡', '常州',
    '佛山', '东莞', '珠海', '中山', '哈尔滨', '沈阳', '石家庄', '太原',
    '呼和浩特', '长春', '长春', '南昌', '温州', '绍兴', '金华', '泉州',
    '烟台', '潍坊', '淄博', '唐山', '徐州', '南通', '东莞'
  ];
  
  for (const city of majorCities) {
    if (location.includes(city)) {
      return city;
    }
  }
  
  const patterns = [
    /([\u4e00-\u9fa5]{2,4})市/,
    /([\u4e00-\u9fa5]{2,3})[省市]/
  ];
  
  for (const pattern of patterns) {
    const match = location.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  if (location.length <= 4 && /^[\u4e00-\u9fa5]{2,4}$/.test(location)) {
    return location;
  }
  
  return null;
}

function normalizeLocation(location) {
  if (!location) return '';
  
  return location
    .replace(/\s+/g, ' ')
    .replace(/[（(][^）)]*[）)]/g, '')
    .trim();
}

function formatLocation(location, city) {
  const parts = [];
  if (city) parts.push(city);
  if (location && location !== city) {
    const normalized = normalizeLocation(location);
    if (normalized && !normalized.includes(city)) {
      parts.push(normalized);
    }
  }
  return parts.join(' - ');
}

function groupBy(list, keyGetter) {
  const map = new Map();
  list.forEach((item) => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return map;
}

function dedupeBy(list, keyGetter) {
  const seen = new Set();
  return list.filter(item => {
    const key = keyGetter(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

function isSameLocation(loc1, loc2, threshold = 0.7) {
  if (!loc1 || !loc2) return false;
  if (loc1 === loc2) return true;
  
  const norm1 = normalizeLocation(loc1);
  const norm2 = normalizeLocation(loc2);
  if (norm1 === norm2) return true;
  
  return calculateSimilarity(norm1, norm2) >= threshold;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

module.exports = {
  parseDate,
  formatDate,
  generateHash,
  generateId,
  extractCity,
  normalizeLocation,
  formatLocation,
  groupBy,
  dedupeBy,
  calculateSimilarity,
  isSameLocation,
  formatDuration
};
