export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

export function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function percentage(value, total) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function validateLevelConfig(config) {
  const requiredFields = ['id', 'name', 'description', 'channels', 'slots', 'tasks'];
  
  for (const field of requiredFields) {
    if (!(field in config)) {
      return { valid: false, error: `缺少必需字段: ${field}` };
    }
  }
  
  if (!Array.isArray(config.tasks) || config.tasks.length === 0) {
    return { valid: false, error: '任务列表不能为空' };
  }
  
  if (config.channels < 1 || config.slots < 1) {
    return { valid: false, error: '频道和时隙数量必须大于0' };
  }
  
  return { valid: true };
}

export function validateSaveData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '存档数据格式无效' };
  }
  
  const requiredFields = ['version', 'timestamp', 'levelId', 'state'];
  
  for (const field of requiredFields) {
    if (!(field in data)) {
      return { valid: false, error: `存档缺少必需字段: ${field}` };
    }
  }
  
  return { valid: true };
}
